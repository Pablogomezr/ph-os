import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, asc, desc } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { uploadBytes } from "@/lib/blob-upload";
import { parseIncomingWebhook, downloadWhatsAppMedia, sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { extractPaymentData } from "@/lib/whatsapp/ocr";
import { reconcilePayment } from "@/lib/reconciliation";
import { generateUnregisteredReply, classifyResidentMessage, type ChatTurn } from "@/lib/whatsapp/chat";
import { isReadOnlyRole } from "@/lib/roles";

const REGISTRATION_MESSAGE =
  "No encontramos tu número registrado. Si vas a reportar un pago, envía la foto o PDF del comprobante indicando " +
  "claramente a qué unidad corresponde (ej. \"Apto 501\", como texto junto con la foto).\n\n" +
  "Si necesitas registrarte, contáme lo siguiente y un administrador te registrará en el sistema:\n" +
  "• Celular\n• Correo electrónico\n• Unidad a la que perteneces (ej. Apto 501, Local 3, Oficina 205)";

type TenantDb = Awaited<ReturnType<typeof getTenantDb>>;

// ─── Verificación del webhook (Meta la llama una sola vez al configurar) ──────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const verifyToken = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Token inválido", { status: 403 });
}

// ─── Mensajes entrantes ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = parseIncomingWebhook(body);

  // Status updates (delivered/read) u otros eventos sin mensaje — ignorar
  if (!parsed) return NextResponse.json({ status: "ok" });

  try {
    await processMessage(parsed);
  } catch (err) {
    console.error("Error procesando mensaje de WhatsApp:", err);
    await sendWhatsAppMessage(
      parsed.phoneNumberId,
      parsed.from,
      "Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo o contacta a la administración."
    ).catch(() => {});
  }

  // WhatsApp exige 200 OK en menos de 20s
  return NextResponse.json({ status: "ok" });
}

// ─── Registro de historial (para verlo desde PH OS en paralelo a WhatsApp) ────
async function logMessage(db: TenantDb, params: {
  unitId: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "document";
  content: string;
  mediaUrl?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}) {
  await db.insert(tenantSchema.whatsappMessages).values({
    id: crypto.randomUUID(),
    unitId: params.unitId,
    phone: params.phone,
    direction: params.direction,
    type: params.type,
    content: params.content,
    mediaUrl: params.mediaUrl ?? null,
    linkedEntityType: params.linkedEntityType ?? null,
    linkedEntityId: params.linkedEntityId ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

// Envía la respuesta por WhatsApp Y la deja registrada en el historial.
async function reply(
  db: TenantDb,
  unitId: string | null,
  phoneNumberId: string,
  to: string,
  text: string,
  linked?: { type: string; id: string }
) {
  await sendWhatsAppMessage(phoneNumberId, to, text);
  await logMessage(db, {
    unitId, phone: to, direction: "outbound", type: "text", content: text,
    linkedEntityType: linked?.type ?? null, linkedEntityId: linked?.id ?? null,
  });
}

async function processMessage(parsed: NonNullable<ReturnType<typeof parseIncomingWebhook>>) {
  const { phoneNumberId, from } = parsed;

  // ── 1. Resolver el edificio dueño de este número de WhatsApp ─────────────
  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select({ slug: superadminSchema.buildings.slug })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.whatsappPhoneId, phoneNumberId))
    .get();

  if (!building) {
    console.error(`Ningún edificio configurado para el número de WhatsApp ${phoneNumberId}`);
    return;
  }

  const db = await getTenantDb(building.slug);

  // ── 2. Validar residente registrado por teléfono ─────────────────────────
  const phoneDigits = from.replace(/\D/g, "");
  const allUsers = await db.select().from(tenantSchema.users).where(eq(tenantSchema.users.active, 1));
  const resident = allUsers.find((u) => u.phone && u.phone.replace(/\D/g, "").endsWith(phoneDigits.slice(-10))) ?? null;

  const residentUnitIds: string[] = resident ? JSON.parse(resident.unitIds || "[]") : [];
  const primaryUnitId = residentUnitIds[0] ?? null;

  // Registrar el mensaje entrante (incluso si el número no está registrado)
  await logMessage(db, {
    unitId: primaryUnitId,
    phone: from,
    direction: "inbound",
    type: parsed.type,
    content: parsed.type === "text" ? (parsed.text ?? "") : (parsed.caption ?? ""),
  });

  // ── 3. Mensajes de texto — saludo simple, o PQRS automática ───────────────
  // Los números desconocidos NO generan PQRS por texto — solo pueden reportar
  // pagos (con soporte + unidad especificada), todo lo demás requiere que la
  // administración los registre primero.
  if (parsed.type === "text") {
    if (!resident) {
      await handleUnregisteredText(db, phoneNumberId, from, parsed.text ?? "");
      return;
    }
    await handleTextMessage(db, resident, phoneNumberId, from, parsed.text ?? "");
    return;
  }

  if (parsed.type !== "image" && parsed.type !== "document") return;
  if (!parsed.mediaId) return;

  await handlePaymentReceipt(db, building.slug, phoneNumberId, from, parsed.mediaId, parsed.caption ?? null, resident);
}

// ─── Procesa un comprobante de pago — de un residente registrado o de un ──────
// número desconocido (siempre que especifique a qué unidad corresponde). ──────
async function handlePaymentReceipt(
  db: TenantDb,
  slug: string,
  phoneNumberId: string,
  from: string,
  mediaId: string,
  caption: string | null,
  resident: typeof tenantSchema.users.$inferSelect | null
): Promise<void> {
  const residentUnitIds: string[] = resident ? JSON.parse(resident.unitIds || "[]") : [];
  const primaryUnitId = residentUnitIds[0] ?? null;

  // Cuentas de solo consulta (Observador) no registran pagos: el propietario
  // supervisa, pero quien gestiona la unidad es el que reporta.
  if (resident && isReadOnlyRole(resident.role)) {
    await reply(
      db, primaryUnitId, phoneNumberId, from,
      `Hola ${resident.name.trim().split(/\s+/)[0]}, tu cuenta está registrada como *solo consulta*, ` +
      "por lo que no podemos registrar pagos desde este número. " +
      "El reporte debe hacerlo quien gestiona la unidad. Puedes consultar el estado de cuenta en el portal."
    );
    return;
  }

  await reply(db, primaryUnitId, phoneNumberId, from, "Recibido, dame un momento para revisarlo… 🔎");

  // ── Descargar el comprobante y subirlo a Blob ─────────────────────────────
  const { bytes, mimeType } = await downloadWhatsAppMedia(mediaId);
  const ext = mimeType.includes("pdf") ? "pdf" : mimeType.split("/")[1] || "jpg";
  const receiptUrl = await uploadBytes(bytes, `whatsapp-pagos/${slug}`, ext);

  await logMessage(db, {
    unitId: primaryUnitId, phone: from,
    direction: "inbound", type: mimeType.includes("pdf") ? "document" : "image",
    content: "Comprobante de pago", mediaUrl: receiptUrl,
  });

  // ── OCR con Claude ──────────────────────────────────────────────────────────
  const payment = await extractPaymentData(bytes, mimeType);

  if (!payment.valid) {
    console.error("OCR falló o retornó valid:false —", JSON.stringify(payment), "mimeType recibido:", mimeType, "bytes:", bytes.length);
    await reply(
      db, primaryUnitId, phoneNumberId, from,
      "No pudimos leer bien el comprobante. ¿Puedes enviar una foto más clara, con el monto y la referencia visibles?" +
      (!resident ? " Recuerda también indicar a qué unidad corresponde el pago (ej. \"Apto 501\")." : "")
    );
    return;
  }

  // ── Anti-duplicado ───────────────────────────────────────────────────────────
  const referencia = (payment.referencia ?? "").trim();
  if (referencia) {
    const dup = await db
      .select({ id: tenantSchema.payments.id })
      .from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.reference, referencia))
      .get();
    if (dup) {
      await reply(
        db, primaryUnitId, phoneNumberId, from,
        `Este comprobante (referencia ${referencia}) ya fue registrado anteriormente.`
      );
      return;
    }
  }

  // ── Resolver la(s) unidad(es) objetivo ────────────────────────────────────
  let targetUnitIds: string[];

  if (resident) {
    if (residentUnitIds.length === 0) {
      await reply(
        db, null, phoneNumberId, from,
        "No tienes una unidad asignada en el sistema. Contacta a la administración para que la registren."
      );
      return;
    }
    targetUnitIds = residentUnitIds;

    // Si tiene varias unidades y logramos identificar una en particular
    // (nota del comprobante, caption o mensaje reciente), se acota a esa —
    // nunca a una unidad ajena al residente.
    if (residentUnitIds.length > 1) {
      const mentionedUnitId = await findMentionedUnitId(db, residentUnitIds, from, payment.unidad_mencionada, caption);
      if (mentionedUnitId) targetUnitIds = [mentionedUnitId];
    }
  } else {
    // Número desconocido — solo se procesa si logramos identificar una unidad
    // REAL del edificio, ya sea en la nota del comprobante, en el texto que
    // acompaña la foto (caption) o en un mensaje de texto reciente del mismo número.
    const mentionedUnitId = await findMentionedUnitId(db, null, from, payment.unidad_mencionada, caption);
    if (!mentionedUnitId) {
      await reply(
        db, null, phoneNumberId, from,
        "Tu número no está registrado. Para procesar tu pago, indica claramente a qué unidad corresponde " +
        "(ej. \"Apto 501\" o \"Local 3\") — puedes escribirlo junto con la foto o en un mensaje aparte."
      );
      return;
    }
    targetUnitIds = [mentionedUnitId];
  }

  const pendingCharges = await db
    .select()
    .from(tenantSchema.charges)
    .where(and(
      inArray(tenantSchema.charges.unitId, targetUnitIds),
      inArray(tenantSchema.charges.status, ["pending", "partial", "overdue"]),
    ))
    .orderBy(asc(tenantSchema.charges.dueDate));

  const concepto = (payment.concepto ?? "").toLowerCase();
  const conceptGuess = concepto.includes("extraordin") ? "extraordinary"
    : concepto.includes("energ") || concepto.includes("vatia") ? "energy"
    : concepto.includes("agua") || concepto.includes("triple a") ? "water"
    : concepto.includes("administr") ? "ordinary"
    : null;

  const charge =
    (conceptGuess && pendingCharges.find((c) => c.concept === conceptGuess)) ||
    pendingCharges[0];

  if (!charge) {
    await reply(
      db, targetUnitIds[0] ?? null, phoneNumberId, from,
      "Recibimos tu comprobante, pero no encontramos un cargo pendiente asociado a esa unidad. Un administrador lo revisará manualmente — guarda este mensaje como respaldo."
    );
    console.error(`Pago sin cargo para conciliar — unidad(es) ${targetUnitIds.join(",")}, edificio ${slug}, monto ${payment.monto}, ref ${referencia}, comprobante ${receiptUrl}`);
    return;
  }

  // ── Conciliar contra el extracto bancario importado ───────────────────────
  // La foto del comprobante por sí sola no confirma que la plata entró a la
  // cuenta del edificio — se cruza contra los movimientos reales del banco
  // (importados en Finanzas → Conciliación) antes de acreditar el cargo.
  const monto = payment.monto ?? 0;
  const bankMovements = await db.select().from(tenantSchema.bankMovements);
  const reconcileResult = reconcilePayment(
    { amount: monto, reference: referencia, date: payment.fecha },
    bankMovements
  );

  // ── Registrar el pago (siempre, para trazabilidad y revisión admin) ──────
  const existingPayments = await db
    .select({ amount: tenantSchema.payments.amount })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, charge.id));
  const alreadyPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = charge.amount - alreadyPaid;
  const isFullMatch = monto > 0 && Math.abs(monto - remaining) < 1000; // tolerancia $1.000 COP
  // Un número desconocido siempre queda pendiente de revisión manual, aunque
  // el banco confirme el movimiento — no hay identidad verificada del remitente.
  const isBankVerified = reconcileResult.status === "verified" && resident !== null;

  const now = Math.floor(Date.now() / 1000);
  const paymentId = crypto.randomUUID();
  await db.insert(tenantSchema.payments).values({
    id: paymentId,
    chargeId: charge.id,
    unitId: charge.unitId,
    amount: monto,
    paymentDate: now,
    method: "transfer",
    reference: referencia || null,
    receiptUrl,
    notes: (isBankVerified
      ? (reconcileResult.notes || "Registrado y verificado contra el extracto bancario (WhatsApp + OCR)")
      : !resident
        ? `Reportado por un número no registrado — pendiente de revisión manual. ${reconcileResult.notes}`
        : `Pendiente de conciliación bancaria — ${reconcileResult.notes}`)
      + (payment.unidad_mencionada ? ` · Unidad mencionada en el comprobante: "${payment.unidad_mencionada}"` : "")
      + (!payment.unidad_mencionada && caption ? ` · Unidad indicada en el mensaje: "${caption}"` : ""),
    bankStatus: isBankVerified ? "verified" : "unverified",
    matchedMovementId: reconcileResult.matchedMovementId,
    reportedByUserId: resident?.id ?? null,
    reportedByPhone: from,
    createdBy: "whatsapp-bot",
    createdAt: now,
  });

  // El cargo solo se marca pagado cuando el banco confirma el movimiento Y el
  // remitente es un residente identificado — así un comprobante editado, una
  // transferencia fallida, o un número desconocido nunca acreditan solos.
  if (isBankVerified) {
    const newStatus = isFullMatch ? "paid" : monto >= remaining ? "paid" : "partial";
    await db
      .update(tenantSchema.charges)
      .set({ status: newStatus, updatedAt: now })
      .where(eq(tenantSchema.charges.id, charge.id));
  }

  await reply(
    db, charge.unitId, phoneNumberId, from,
    isBankVerified
      ? (isFullMatch
          ? `✅ ¡Gracias ${resident!.name}! Verificamos tu pago de $${monto.toLocaleString("es-CO")} contra el banco (ref. ${referencia || "N/A"}).`
          : `✅ Verificamos tu pago de $${monto.toLocaleString("es-CO")} contra el banco, pero el monto no coincide exactamente con el cargo — un administrador ajustará el saldo.`)
      : !resident
        ? `Recibimos tu comprobante de $${monto.toLocaleString("es-CO")} para la unidad indicada. Como tu número no está registrado, un administrador lo revisará manualmente antes de acreditarlo.`
        : `Recibimos tu comprobante de $${monto.toLocaleString("es-CO")}. Aún no lo encontramos en los movimientos bancarios — quedó pendiente de confirmación y un administrador lo revisará antes de acreditarlo.`,
    { type: "payment", id: paymentId }
  );
}

// ─── Identifica a qué unidad corresponde un pago a partir de (en orden): ──────
// la nota del comprobante (OCR), el texto que acompaña la foto (caption), o el
// mensaje de texto entrante más reciente del mismo número (ventana de 30 min).
// Si candidateUnitIds es null, se busca entre TODAS las unidades del edificio
// (caso de números desconocidos); si no, solo entre esas unidades.
async function findMentionedUnitId(
  db: TenantDb,
  candidateUnitIds: string[] | null,
  from: string,
  ocrMentioned: string | null | undefined,
  caption: string | null
): Promise<string | null> {
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const units = candidateUnitIds
    ? await db.select({ id: tenantSchema.units.id, number: tenantSchema.units.number })
        .from(tenantSchema.units)
        .where(inArray(tenantSchema.units.id, candidateUnitIds))
    : await db.select({ id: tenantSchema.units.id, number: tenantSchema.units.number })
        .from(tenantSchema.units);

  const tryMatch = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const norm = normalize(text);
    if (!norm) return null;
    return units.find((u) => norm.includes(normalize(u.number)))?.id ?? null;
  };

  const fromReceipt = tryMatch(ocrMentioned) ?? tryMatch(caption);
  if (fromReceipt) return fromReceipt;

  // Último recurso: buscar la unidad en mensajes de texto recientes del mismo
  // número (ej. "Hola, adjunto el pago del Apto 501" enviado justo antes de la foto).
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 60;
  const recentTexts = await db
    .select({ content: tenantSchema.whatsappMessages.content, createdAt: tenantSchema.whatsappMessages.createdAt })
    .from(tenantSchema.whatsappMessages)
    .where(and(
      eq(tenantSchema.whatsappMessages.phone, from),
      eq(tenantSchema.whatsappMessages.direction, "inbound"),
      eq(tenantSchema.whatsappMessages.type, "text"),
    ))
    .orderBy(desc(tenantSchema.whatsappMessages.createdAt))
    .limit(5);

  for (const m of recentTexts) {
    if (m.createdAt < cutoff) break;
    const matched = tryMatch(m.content);
    if (matched) return matched;
  }

  return null;
}

function formatTicket(n: number) {
  return `PQR-${String(n).padStart(4, "0")}`;
}

const IS_GREETING = /^(hola|buenas|hey|hi|buenos d[ií]as|buenas tardes|buenas noches)[\s!.,👋🙌]*$/i;

// Combina turnos consecutivos del mismo rol en uno solo — la API de Claude
// exige que los mensajes alternen estrictamente user/assistant.
function mergeConsecutiveRoles(turns: ChatTurn[]): ChatTurn[] {
  const merged: ChatTurn[] = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) {
      last.content += "\n" + t.content;
    } else {
      merged.push({ ...t });
    }
  }
  return merged;
}

// ─── Mensajes de texto de números NO registrados ──────────────────────────────
// Primer contacto (o saludo): responde el saludo y luego el mensaje de registro,
// como dos mensajes separados, para que se sienta natural. Si la conversación
// continúa, genera una respuesta contextual con IA en vez de repetir el mismo
// mensaje — para que no se note que son respuestas automáticas.
async function handleUnregisteredText(
  db: TenantDb,
  phoneNumberId: string,
  from: string,
  rawText: string
): Promise<void> {
  const text = rawText.trim();
  const isGreeting = IS_GREETING.test(text) || text.length < 4;

  const history = await db
    .select({
      direction: tenantSchema.whatsappMessages.direction,
      content: tenantSchema.whatsappMessages.content,
      type: tenantSchema.whatsappMessages.type,
    })
    .from(tenantSchema.whatsappMessages)
    .where(eq(tenantSchema.whatsappMessages.phone, from))
    .orderBy(desc(tenantSchema.whatsappMessages.createdAt))
    .limit(12);

  const hasRepliedBefore = history.some((m) => m.direction === "outbound");

  if (isGreeting || !hasRepliedBefore) {
    await reply(db, null, phoneNumberId, from, "¡Hola! 👋");
    await reply(db, null, phoneNumberId, from, REGISTRATION_MESSAGE);
    return;
  }

  const turns = mergeConsecutiveRoles(
    [...history].reverse()
      .filter((m) => m.type === "text" && m.content)
      .map((m) => ({
        role: (m.direction === "outbound" ? "assistant" : "user") as ChatTurn["role"],
        content: m.content,
      }))
  );

  const replyText = await generateUnregisteredReply(turns);
  await reply(db, null, phoneNumberId, from, replyText);
}

// ─── Mensajes de texto: saludo simple, o PQRS automática para todo lo demás ──
async function handleTextMessage(
  db: TenantDb,
  resident: typeof tenantSchema.users.$inferSelect,
  phoneNumberId: string,
  from: string,
  rawText: string
) {
  const unitIds: string[] = JSON.parse(resident.unitIds || "[]");
  const primaryUnitId = unitIds[0] ?? null;
  const text = rawText.trim();
  const isGreeting = IS_GREETING.test(text) || text.length < 4;

  if (unitIds.length === 0) {
    await reply(
      db, null, phoneNumberId, from,
      "Recibimos tu mensaje, pero no tienes una unidad asignada en el sistema. Contacta directamente a la administración para que te atiendan."
    );
    return;
  }

  const history = await db
    .select({
      direction: tenantSchema.whatsappMessages.direction,
      content: tenantSchema.whatsappMessages.content,
      type: tenantSchema.whatsappMessages.type,
    })
    .from(tenantSchema.whatsappMessages)
    .where(eq(tenantSchema.whatsappMessages.phone, from))
    .orderBy(desc(tenantSchema.whatsappMessages.createdAt))
    .limit(12);

  const hasRepliedBefore = history.some((m) => m.direction === "outbound");

  // Primer contacto (o saludo): solo saluda y pregunta qué necesita — da un
  // compás de espera real, sin radicar nada ni asumir de qué se trata todavía.
  if (isGreeting || !hasRepliedBefore) {
    const firstName = resident.name.trim().split(/\s+/)[0];
    await reply(
      db, primaryUnitId, phoneNumberId, from,
      `Hola ${firstName} 👋 ¿En qué te puedo ayudar hoy? Si vas a reportar un pago, envíame la foto o PDF del comprobante. Si es otra cosa, cuéntame qué necesitas y con gusto te ayudo.`
    );
    return;
  }

  // La conversación ya está en curso — se clasifica la intención con IA en
  // vez de radicar un PQRS automáticamente por cualquier mensaje. Solo se
  // crea el PQRS cuando el residente hace una solicitud/queja/reclamo/
  // sugerencia explícita; de lo contrario se responde y se sigue esperando.
  const turns = mergeConsecutiveRoles(
    [...history].reverse()
      .filter((m) => m.type === "text" && m.content)
      .map((m) => ({
        role: (m.direction === "outbound" ? "assistant" : "user") as ChatTurn["role"],
        content: m.content,
      }))
  );

  const intent = await classifyResidentMessage(turns);

  if (intent.action === "reply") {
    await reply(db, primaryUnitId, phoneNumberId, from, intent.reply);
    return;
  }

  // action === "pqrs" — el residente sí hizo una solicitud explícita
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  await db.insert(tenantSchema.pqrs).values({
    id,
    unitId: primaryUnitId!,
    userId: resident.id,
    type: intent.type,
    subject: intent.subject,
    description: intent.description,
    status: "open",
    priority: "normal",
    response: null,
    attachments: "[]",
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Consecutivo global — mismo criterio que el módulo PQRS de la app
  const allPqrs = await db
    .select({ id: tenantSchema.pqrs.id, createdAt: tenantSchema.pqrs.createdAt })
    .from(tenantSchema.pqrs);
  const ticketNumber = [...allPqrs]
    .sort((a, b) => a.createdAt - b.createdAt)
    .findIndex((p) => p.id === id) + 1;

  await reply(
    db, primaryUnitId, phoneNumberId, from,
    `${intent.reply} Quedó radicado como ${formatTicket(ticketNumber)}.`,
    { type: "pqrs", id }
  );
}
