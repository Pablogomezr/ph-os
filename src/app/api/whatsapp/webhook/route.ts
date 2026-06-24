import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, asc } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { uploadBytes } from "@/lib/blob-upload";
import { parseIncomingWebhook, downloadWhatsAppMedia, sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { extractPaymentData } from "@/lib/whatsapp/ocr";

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
  const resident = allUsers.find((u) => u.phone && u.phone.replace(/\D/g, "").endsWith(phoneDigits.slice(-10)));

  if (!resident) {
    await sendWhatsAppMessage(
      phoneNumberId, from,
      "No encontramos tu número registrado. Por favor contacta a la administración para que te registren con este número de WhatsApp."
    );
    return;
  }

  // ── 3. Mensajes de texto — respuesta simple por ahora ─────────────────────
  if (parsed.type === "text") {
    await sendWhatsAppMessage(
      phoneNumberId, from,
      "Hola 👋 Para registrar un pago, envíame una foto o PDF del comprobante de transferencia."
    );
    return;
  }

  if (parsed.type !== "image" && parsed.type !== "document") return;
  if (!parsed.mediaId) return;

  await sendWhatsAppMessage(phoneNumberId, from, "Recibido, dame un momento para revisarlo… 🔎");

  // ── 4. Descargar el comprobante y subirlo a Blob ──────────────────────────
  const { bytes, mimeType } = await downloadWhatsAppMedia(parsed.mediaId);
  const ext = mimeType.includes("pdf") ? "pdf" : mimeType.split("/")[1] || "jpg";
  const receiptUrl = await uploadBytes(bytes, `whatsapp-pagos/${building.slug}`, ext);

  // ── 5. OCR con Claude ──────────────────────────────────────────────────────
  const payment = await extractPaymentData(bytes, mimeType);

  if (!payment.valid) {
    await sendWhatsAppMessage(
      phoneNumberId, from,
      "No pudimos leer bien el comprobante. ¿Puedes enviar una foto más clara, con el monto y la referencia visibles?"
    );
    return;
  }

  // ── 6. Anti-duplicado ──────────────────────────────────────────────────────
  const referencia = (payment.referencia ?? "").trim();
  if (referencia) {
    const dup = await db
      .select({ id: tenantSchema.payments.id })
      .from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.reference, referencia))
      .get();
    if (dup) {
      await sendWhatsAppMessage(
        phoneNumberId, from,
        `Este comprobante (referencia ${referencia}) ya fue registrado anteriormente.`
      );
      return;
    }
  }

  // ── 7. Buscar el cargo pendiente más relevante de las unidades del residente ─
  const unitIds: string[] = JSON.parse(resident.unitIds || "[]");
  if (unitIds.length === 0) {
    await sendWhatsAppMessage(
      phoneNumberId, from,
      "No tienes una unidad asignada en el sistema. Contacta a la administración para que la registren."
    );
    return;
  }

  const pendingCharges = await db
    .select()
    .from(tenantSchema.charges)
    .where(and(
      inArray(tenantSchema.charges.unitId, unitIds),
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
    await sendWhatsAppMessage(
      phoneNumberId, from,
      "Recibimos tu comprobante, pero no encontramos un cargo pendiente asociado a tu unidad. Un administrador lo revisará manualmente — guarda este mensaje como respaldo."
    );
    console.error(`Pago sin cargo para conciliar — unidad(es) ${unitIds.join(",")}, edificio ${building.slug}, monto ${payment.monto}, ref ${referencia}, comprobante ${receiptUrl}`);
    return;
  }

  // ── 8. Registrar el pago ───────────────────────────────────────────────────
  const existingPayments = await db
    .select({ amount: tenantSchema.payments.amount })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, charge.id));
  const alreadyPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const monto = payment.monto ?? 0;
  const remaining = charge.amount - alreadyPaid;
  const isFullMatch = monto > 0 && Math.abs(monto - remaining) < 1000; // tolerancia $1.000 COP
  const newStatus = isFullMatch ? "paid" : monto >= remaining ? "paid" : "partial";

  const now = Math.floor(Date.now() / 1000);
  await db.insert(tenantSchema.payments).values({
    id: crypto.randomUUID(),
    chargeId: charge.id,
    unitId: charge.unitId,
    amount: monto,
    paymentDate: now,
    method: "transfer",
    reference: referencia || null,
    receiptUrl,
    notes: isFullMatch
      ? "Registrado automáticamente vía WhatsApp (OCR)"
      : "Registrado vía WhatsApp (OCR) — monto no coincide exactamente con el cargo, requiere revisión",
    createdBy: "whatsapp-bot",
    createdAt: now,
  });

  await db
    .update(tenantSchema.charges)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(tenantSchema.charges.id, charge.id));

  await sendWhatsAppMessage(
    phoneNumberId, from,
    isFullMatch
      ? `✅ ¡Gracias ${resident.name}! Registramos tu pago de $${monto.toLocaleString("es-CO")} (ref. ${referencia || "N/A"}).`
      : `Recibimos tu comprobante de $${monto.toLocaleString("es-CO")}, pero el monto no coincide exactamente con el cargo pendiente. Un administrador lo revisará.`
  );
}
