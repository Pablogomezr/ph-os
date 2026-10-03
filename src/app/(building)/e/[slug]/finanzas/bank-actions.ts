"use server";

import { requireAccesoPanel } from "@/lib/auth/helpers";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, inArray, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseBankStatement } from "@/lib/bank-import";
import { recalcChargeStatus } from "./recalc";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export type BankImportState = { error?: string; success?: boolean; imported?: number; skipped?: number } | null;

// ─── Importar extracto bancario ───────────────────────────────────────────────
export async function importBankStatement(
  slug: string,
  _prev: BankImportState,
  formData: FormData
): Promise<BankImportState> {
  const { userId } = await requireAccesoPanel(slug);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo de extracto (.xlsx, .xls, .csv o .pdf)." };
  }

  const mode = (formData.get("mode") as string) === "reemplazar" ? "reemplazar" : "agregar";

  const db = await getTenantDb(slug);
  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseBankStatement(buffer, file.name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo leer el archivo." };
  }

  if (parsed.length === 0) {
    return { error: "No se encontraron movimientos de crédito/abono en el archivo." };
  }

  if (mode === "reemplazar") {
    await db.delete(tenantSchema.bankMovements);
    const now = Math.floor(Date.now() / 1000);
    await db.insert(tenantSchema.bankMovements).values(
      parsed.map((m) => ({ id: crypto.randomUUID(), ...m, createdAt: now }))
    );
    revalidatePath(`/e/${slug}/finanzas`);
    return { success: true, imported: parsed.length, skipped: 0 };
  }

  // Modo agregar: evitar duplicar por referencia ya existente (cuando hay referencia)
  const existing = await db
    .select({ reference: tenantSchema.bankMovements.reference })
    .from(tenantSchema.bankMovements);
  const existingRefs = new Set(existing.map((r) => r.reference).filter((r) => r !== ""));

  const nuevos = parsed.filter((m) => m.reference === "" || !existingRefs.has(m.reference));
  const skipped = parsed.length - nuevos.length;

  if (nuevos.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(tenantSchema.bankMovements).values(
      nuevos.map((m) => ({ id: crypto.randomUUID(), ...m, createdAt: now }))
    );
  }

  revalidatePath(`/e/${slug}/finanzas`);
  return { success: true, imported: nuevos.length, skipped };
}

// ─── Resolver manualmente un pago pendiente de conciliación ──────────────────
export async function resolvePendingPayment(
  slug: string,
  paymentId: string,
  action: "verify" | "reject"
): Promise<void> {
  const { userId } = await requireAccesoPanel(slug);

  const db = await getTenantDb(slug);
  const payment = await db
    .select()
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.id, paymentId))
    .get();
  if (!payment) return;

  if (action === "verify") {
    await db
      .update(tenantSchema.payments)
      .set({ bankStatus: "manual" })
      .where(eq(tenantSchema.payments.id, paymentId));

    const existingPayments = await db
      .select({ amount: tenantSchema.payments.amount })
      .from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.chargeId, payment.chargeId));
    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);

    const charge = await db
      .select({ amount: tenantSchema.charges.amount })
      .from(tenantSchema.charges)
      .where(eq(tenantSchema.charges.id, payment.chargeId))
      .get();
    if (charge) {
      const status = totalPaid >= charge.amount ? "paid" : "partial";
      await db
        .update(tenantSchema.charges)
        .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(tenantSchema.charges.id, payment.chargeId));
    }
  } else {
    // Rechazar: elimina el registro de pago (no se acredita al cargo)
    await db.delete(tenantSchema.payments).where(eq(tenantSchema.payments.id, paymentId));
  }

  revalidatePath(`/e/${slug}/finanzas`);
}

// ─── Vincular un movimiento bancario a un cargo/unidad por coincidencia ──────
// exacta de valor — identifica de qué unidad es un pago que llegó al banco
// sin que nadie lo reportara (ni por WhatsApp ni manualmente).
export async function linkMovementToCharge(
  slug: string,
  movementId: string,
  chargeId: string
): Promise<{ error?: string } | void> {
  const { userId } = await requireAccesoPanel(slug);

  const db = await getTenantDb(slug);

  const [movement, charge] = await Promise.all([
    db.select().from(tenantSchema.bankMovements).where(eq(tenantSchema.bankMovements.id, movementId)).get(),
    db.select().from(tenantSchema.charges).where(eq(tenantSchema.charges.id, chargeId)).get(),
  ]);
  if (!movement) return { error: "Movimiento bancario no encontrado." };
  if (!charge)   return { error: "Cargo no encontrado." };

  // Evitar vincular el mismo movimiento dos veces
  const already = await db
    .select({ id: tenantSchema.payments.id })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.matchedMovementId, movementId))
    .get();
  if (already) return { error: "Este movimiento ya está vinculado a un pago." };

  const now = Math.floor(Date.now() / 1000);

  await db.insert(tenantSchema.payments).values({
    id: crypto.randomUUID(),
    chargeId,
    unitId: charge.unitId,
    amount: movement.amount,
    paymentDate: movement.date,
    method: "transfer",
    reference: movement.reference || null,
    notes: "Vinculado por coincidencia exacta de valor con el movimiento bancario (Conciliación).",
    bankStatus: "verified",
    matchedMovementId: movement.id,
    createdBy: userId,
    createdAt: now,
  });

  const existingPayments = await db
    .select({ amount: tenantSchema.payments.amount })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, chargeId));
  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const status = totalPaid >= charge.amount - 0.01 ? "paid" : "partial";

  await db
    .update(tenantSchema.charges)
    .set({ status, updatedAt: now })
    .where(eq(tenantSchema.charges.id, chargeId));

  revalidatePath(`/e/${slug}/finanzas`);
}

// ─── Aplicar un MOVIMIENTO bancario, dividido entre varios cargos ────────────
// Usado cuando la referencia del movimiento reconoce la unidad (alias) — se
// reparte el monto entre los cargos pendientes de esa unidad sin exceder el
// monto del movimiento ni el saldo de cada cargo.
export async function applyMovementSplit(
  slug: string,
  movementId: string,
  allocations: { chargeId: string; amount: number }[],
  remember = false
): Promise<{ error?: string } | void> {
  const { userId } = await requireAccesoPanel(slug);

  const cleaned = allocations.filter((a) => a.amount > 0);
  if (cleaned.length === 0) return { error: "Ingresa al menos un monto a aplicar." };

  const db = await getTenantDb(slug);

  const movement = await db.select().from(tenantSchema.bankMovements)
    .where(eq(tenantSchema.bankMovements.id, movementId)).get();
  if (!movement) return { error: "Movimiento bancario no encontrado." };

  const already = await db.select({ id: tenantSchema.payments.id }).from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.matchedMovementId, movementId)).get();
  if (already) return { error: "Este movimiento ya está vinculado a un pago." };

  const totalAllocated = cleaned.reduce((s, a) => s + a.amount, 0);
  if (totalAllocated > movement.amount + 0.01) {
    return { error: `La suma (${formatCOP(totalAllocated)}) supera el monto del movimiento (${formatCOP(movement.amount)}).` };
  }

  const chargeIds = [...new Set(cleaned.map((a) => a.chargeId))];
  const charges = await db.select().from(tenantSchema.charges)
    .where(inArray(tenantSchema.charges.id, chargeIds));
  const chargeById = new Map(charges.map((c) => [c.id, c]));

  for (const a of cleaned) {
    const charge = chargeById.get(a.chargeId);
    if (!charge) return { error: "Uno de los cargos seleccionados no existe." };
    const existing = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.chargeId, a.chargeId))
      .get();
    const remaining = charge.amount - (existing?.total ?? 0);
    if (a.amount > remaining + 0.01) {
      return { error: `El monto para "${charge.description ?? charge.concept}" (${formatCOP(a.amount)}) supera su saldo (${formatCOP(remaining)}).` };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  await db.insert(tenantSchema.payments).values(
    cleaned.map((a, i) => ({
      id: crypto.randomUUID(),
      chargeId: a.chargeId,
      unitId: chargeById.get(a.chargeId)!.unitId,
      amount: a.amount,
      paymentDate: movement.date,
      method: "transfer",
      reference: movement.reference || null,
      notes: "Conciliado por referencia reconocida (alias) contra el movimiento bancario.",
      bankStatus: "verified",
      // solo el primer registro lleva el matchedMovementId (evita duplicar el vínculo)
      matchedMovementId: i === 0 ? movement.id : null,
      createdBy: userId,
      createdAt: now,
    }))
  );

  for (const chargeId of chargeIds) await recalcChargeStatus(db, chargeId);

  // Aprender la referencia: guarda un alias (referencia → unidad) para que el
  // próximo pago con esa misma referencia se reconozca automáticamente.
  if (remember && movement.reference?.trim()) {
    const ref = movement.reference.trim().toUpperCase();
    const unitIds = [...new Set(cleaned.map((a) => chargeById.get(a.chargeId)!.unitId))];
    for (const unitId of unitIds) {
      const dup = await db.select({ id: tenantSchema.paymentReferences.id })
        .from(tenantSchema.paymentReferences)
        .where(and(
          eq(tenantSchema.paymentReferences.reference, ref),
          eq(tenantSchema.paymentReferences.unitId, unitId),
        ))
        .get();
      if (!dup) {
        await db.insert(tenantSchema.paymentReferences).values({
          id: crypto.randomUUID(), reference: ref, unitId,
          note: "Aprendido al asignar un movimiento manualmente.", createdAt: now,
        });
      }
    }
  }

  revalidatePath(`/e/${slug}/finanzas`);
}

// ─── Aplicar un pago dividido entre varios cargos ────────────────────────────
// Cuando un cliente paga varios meses/conceptos de una sola vez, el monto
// reportado no coincide con ningún cargo individual. Esto permite repartir
// ese único pago entre los cargos que el administrador elija, sin poder
// exceder el monto total del pago ni el saldo de cada cargo.
export async function applyPaymentSplit(
  slug: string,
  paymentId: string,
  allocations: { chargeId: string; amount: number }[]
): Promise<{ error?: string } | void> {
  const { userId } = await requireAccesoPanel(slug);

  const cleaned = allocations.filter((a) => a.amount > 0);
  if (cleaned.length === 0) return { error: "Ingresa al menos un monto a aplicar." };

  const db = await getTenantDb(slug);

  const payment = await db
    .select().from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.id, paymentId))
    .get();
  if (!payment) return { error: "Pago no encontrado." };

  const totalAllocated = cleaned.reduce((s, a) => s + a.amount, 0);
  if (totalAllocated > payment.amount + 0.01) {
    return { error: `La suma de los montos (${formatCOP(totalAllocated)}) supera el monto del pago (${formatCOP(payment.amount)}).` };
  }

  const chargeIds = [...new Set(cleaned.map((a) => a.chargeId))];
  const charges = await db
    .select().from(tenantSchema.charges)
    .where(inArray(tenantSchema.charges.id, chargeIds));
  const chargeById = new Map(charges.map((c) => [c.id, c]));

  for (const a of cleaned) {
    const charge = chargeById.get(a.chargeId);
    if (!charge) return { error: "Uno de los cargos seleccionados no existe." };
    if (charge.unitId !== payment.unitId) {
      return { error: "Todos los cargos deben pertenecer a la misma unidad del pago." };
    }

    const existingResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.chargeId, a.chargeId))
      .get();
    // Si el pago original ya estaba ligado a este mismo cargo, se descuenta
    // su monto actual del total existente (se va a reemplazar de todas formas).
    const alreadyOther = (existingResult?.total ?? 0) - (payment.chargeId === a.chargeId ? payment.amount : 0);
    const remaining = charge.amount - alreadyOther;
    if (a.amount > remaining + 0.01) {
      return { error: `El monto para "${charge.description ?? charge.concept}" (${formatCOP(a.amount)}) supera su saldo pendiente (${formatCOP(remaining)}).` };
    }
  }

  const now = Math.floor(Date.now() / 1000);

  // Se reemplaza el pago original por un registro individual en cada cargo elegido.
  await db.delete(tenantSchema.payments).where(eq(tenantSchema.payments.id, paymentId));

  await db.insert(tenantSchema.payments).values(
    cleaned.map((a) => ({
      id: crypto.randomUUID(),
      chargeId: a.chargeId,
      unitId: payment.unitId,
      amount: a.amount,
      paymentDate: payment.paymentDate,
      method: payment.method,
      reference: payment.reference,
      receiptUrl: payment.receiptUrl,
      notes: "Aplicado por conciliación manual dividida" + (payment.notes ? ` — ${payment.notes}` : ""),
      bankStatus: payment.bankStatus === "unverified" ? "manual" : payment.bankStatus,
      matchedMovementId: payment.matchedMovementId,
      reportedByUserId: payment.reportedByUserId,
      reportedByPhone: payment.reportedByPhone,
      createdBy: userId,
      createdAt: now,
    }))
  );

  for (const chargeId of chargeIds) {
    await recalcChargeStatus(db, chargeId);
  }

  revalidatePath(`/e/${slug}/finanzas`);
}
