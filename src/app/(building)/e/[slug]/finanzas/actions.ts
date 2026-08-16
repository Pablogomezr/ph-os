"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { uploadAttachments } from "@/lib/blob-upload";

export type ChargeFormState     = { error?: string; success?: boolean } | null;
export type MassChargeFormState = { error?: string; success?: boolean; count?: number } | null;
export type PaymentFormState    = { error?: string; success?: boolean } | null;

// Recalcula y guarda el estado del cargo (paid/partial/pending) según la
// suma actual de sus pagos — usado tras editar o eliminar un pago.
export async function recalcChargeStatus(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  chargeId: string
): Promise<void> {
  const charge = await db
    .select({ amount: tenantSchema.charges.amount })
    .from(tenantSchema.charges)
    .where(eq(tenantSchema.charges.id, chargeId))
    .get();
  if (!charge) return;

  const totalResult = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, chargeId))
    .get();
  const totalPaid = totalResult?.total ?? 0;

  const status = totalPaid <= 0 ? "pending" : totalPaid >= charge.amount - 0.01 ? "paid" : "partial";
  await db
    .update(tenantSchema.charges)
    .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(tenantSchema.charges.id, chargeId));
}

const VALID_CONCEPTS = ["ordinary", "extraordinary", "energy", "water", "audit", "other"];

// ─── Cargo individual ─────────────────────────────────────────────────────────
export async function createCharge(
  slug: string,
  _prev: ChargeFormState,
  formData: FormData
): Promise<ChargeFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const unitId      = (formData.get("unitId")      as string)?.trim();
  const concept     = (formData.get("concept")     as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const reference   = (formData.get("reference")   as string)?.trim() || null;
  const amountRaw   =  formData.get("amount")      as string;
  const dueDateStr  =  formData.get("dueDate")     as string;

  if (!unitId)                                    return { error: "Selecciona una unidad." };
  if (!concept || !VALID_CONCEPTS.includes(concept)) return { error: "Concepto inválido." };
  if (!dueDateStr)                                return { error: "La fecha de vencimiento es requerida." };

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) return { error: "El monto debe ser mayor a $0." };

  const dueDate = Math.floor(new Date(dueDateStr + "T12:00:00").getTime() / 1000);
  const now     = Math.floor(Date.now() / 1000);

  const db = await getTenantDb(slug);
  await db.insert(tenantSchema.charges).values({
    id:        crypto.randomUUID(),
    unitId,
    concept,
    description,
    reference,
    amount,
    dueDate,
    status:    "pending",
    isMass:    0,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

// ─── Cobro masivo ─────────────────────────────────────────────────────────────
export async function createMassCharges(
  slug: string,
  _prev: MassChargeFormState,
  formData: FormData
): Promise<MassChargeFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const concept     = (formData.get("concept")     as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const amountType  =  formData.get("amountType")  as string; // "fixed" | "coeff"
  const dueDateStr  =  formData.get("dueDate")     as string;

  if (!concept || !VALID_CONCEPTS.includes(concept)) return { error: "Concepto inválido." };
  if (!dueDateStr)                                   return { error: "La fecha de vencimiento es requerida." };
  if (!["fixed", "coeff"].includes(amountType))      return { error: "Tipo de monto inválido." };

  const db    = await getTenantDb(slug);
  const units = await db.select().from(tenantSchema.units);
  if (units.length === 0) return { error: "No hay unidades registradas en este edificio." };

  const dueDate = Math.floor(new Date(dueDateStr + "T12:00:00").getTime() / 1000);
  const batchId = crypto.randomUUID();
  const now     = Math.floor(Date.now() / 1000);

  if (amountType === "fixed") {
    const fixedAmount = parseFloat(formData.get("fixedAmount") as string);
    if (isNaN(fixedAmount) || fixedAmount <= 0)
      return { error: "El monto fijo debe ser mayor a $0." };

    const rows = units.map((u) => ({
      id: crypto.randomUUID(), unitId: u.id, concept, description,
      amount: fixedAmount, dueDate, status: "pending" as const,
      isMass: 1, batchId, createdBy: userId, createdAt: now, updatedAt: now,
    }));
    await db.insert(tenantSchema.charges).values(rows);

  } else {
    // Por coeficiente — distribuye el monto total proporcionalmente
    const totalAmount = parseFloat(formData.get("totalAmount") as string);
    if (isNaN(totalAmount) || totalAmount <= 0)
      return { error: "El monto total debe ser mayor a $0." };

    const rows = units.map((u) => ({
      id: crypto.randomUUID(), unitId: u.id, concept, description,
      amount: Math.round(totalAmount * u.coefficient),
      dueDate, status: "pending" as const,
      isMass: 1, batchId, createdBy: userId, createdAt: now, updatedAt: now,
    }));
    await db.insert(tenantSchema.charges).values(rows);
  }

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true, count: units.length };
}

// ─── Registrar pago ───────────────────────────────────────────────────────────
export async function recordPayment(
  slug: string,
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const chargeId  = (formData.get("chargeId")  as string)?.trim();
  const unitId    = (formData.get("unitId")    as string)?.trim();
  const amountRaw =  formData.get("amount")    as string;
  const method    = (formData.get("method")    as string) || "transfer";
  const reference = (formData.get("reference") as string)?.trim() || null;
  const notes     = (formData.get("notes")     as string)?.trim() || null;

  if (!chargeId) return { error: "Cargo no identificado." };
  if (!unitId)   return { error: "Unidad no identificada." };

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) return { error: "El monto del pago debe ser mayor a $0." };

  const db = await getTenantDb(slug);

  const charge = await db
    .select().from(tenantSchema.charges)
    .where(eq(tenantSchema.charges.id, chargeId))
    .get();

  if (!charge)               return { error: "Cargo no encontrado." };
  if (charge.status === "paid") return { error: "Este cargo ya está completamente pagado." };

  // Suma pagos previos de este cargo
  const existingResult = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, chargeId))
    .get();

  const alreadyPaid = existingResult?.total ?? 0;
  const remaining   = charge.amount - alreadyPaid;

  if (amount > remaining + 0.01) {
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
    return { error: `El pago (${fmt(amount)}) supera el saldo pendiente (${fmt(remaining)}).` };
  }

  const now = Math.floor(Date.now() / 1000);

  const receiptFile = formData.get("receipt");
  const receiptUrl = receiptFile instanceof File && receiptFile.size > 0
    ? (await uploadAttachments([receiptFile], `payments/${slug}`))[0] ?? null
    : null;

  await db.insert(tenantSchema.payments).values({
    id: crypto.randomUUID(), chargeId, unitId, amount,
    paymentDate: now, method, reference, notes, receiptUrl,
    createdBy: userId, createdAt: now,
  });

  // Actualizar estado del cargo
  const totalPaid = alreadyPaid + amount;
  const newStatus = totalPaid >= charge.amount - 0.01 ? "paid" : "partial";
  await db
    .update(tenantSchema.charges)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(tenantSchema.charges.id, chargeId));

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

// ─── Editar pago ──────────────────────────────────────────────────────────────
export async function updatePayment(
  slug: string,
  paymentId: string,
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const amountRaw   =  formData.get("amount")      as string;
  const method      = (formData.get("method")      as string) || "transfer";
  const reference   = (formData.get("reference")   as string)?.trim() || null;
  const notes       = (formData.get("notes")       as string)?.trim() || null;
  const dateStr     =  formData.get("paymentDate") as string;

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) return { error: "El monto del pago debe ser mayor a $0." };

  const db = await getTenantDb(slug);

  const payment = await db
    .select().from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.id, paymentId))
    .get();
  if (!payment) return { error: "Pago no encontrado." };

  const charge = await db
    .select().from(tenantSchema.charges)
    .where(eq(tenantSchema.charges.id, payment.chargeId))
    .get();
  if (!charge) return { error: "El cargo asociado a este pago ya no existe." };

  // Saldo disponible excluyendo este mismo pago
  const otherResult = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, payment.chargeId))
    .get();
  const otherPaid = (otherResult?.total ?? 0) - payment.amount;
  const remaining = charge.amount - otherPaid;

  if (amount > remaining + 0.01) {
    const fmt = (n: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
    return { error: `El pago (${fmt(amount)}) supera el saldo del cargo (${fmt(remaining)}).` };
  }

  const paymentDate = dateStr
    ? Math.floor(new Date(dateStr + "T12:00:00").getTime() / 1000)
    : payment.paymentDate;

  await db.update(tenantSchema.payments).set({
    amount, method, reference, notes, paymentDate,
  }).where(eq(tenantSchema.payments.id, paymentId));

  await recalcChargeStatus(db, payment.chargeId);

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

// ─── Eliminar pago ────────────────────────────────────────────────────────────
export async function deletePayment(slug: string, paymentId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  const payment = await db
    .select({ chargeId: tenantSchema.payments.chargeId })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.id, paymentId))
    .get();
  if (!payment) return;

  await db.delete(tenantSchema.payments).where(eq(tenantSchema.payments.id, paymentId));
  await recalcChargeStatus(db, payment.chargeId);

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
}

// ─── Eliminar cargo ───────────────────────────────────────────────────────────
export async function deleteCharge(slug: string, chargeId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  // Solo eliminar si no hay pagos
  const existingPayment = await db
    .select({ id: tenantSchema.payments.id })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, chargeId))
    .get();

  if (existingPayment) return; // tiene pagos — no eliminar (el botón no debería mostrarse)

  await db.delete(tenantSchema.charges).where(eq(tenantSchema.charges.id, chargeId));

  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
}
