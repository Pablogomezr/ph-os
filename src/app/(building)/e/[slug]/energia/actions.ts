"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type ReadingFormState = { error?: string; success?: boolean } | null;
export type BillFormState    = { error?: string; success?: boolean } | null;

// ─── Registrar lectura ────────────────────────────────────────────────────────
export async function createReading(
  slug: string,
  _prev: ReadingFormState,
  formData: FormData
): Promise<ReadingFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const unitId          = (formData.get("unitId")          as string)?.trim();
  const meterNumber     = (formData.get("meterNumber")     as string)?.trim() || null;
  const prevReadingRaw  =  formData.get("previousReading") as string;
  const currReadingRaw  =  formData.get("currentReading")  as string;
  const rateRaw         =  formData.get("ratePerKwh")      as string;
  const readingDateStr  =  formData.get("readingDate")     as string;

  if (!unitId)           return { error: "Selecciona una unidad." };
  if (!readingDateStr)   return { error: "La fecha de lectura es requerida." };

  const previousReading = parseFloat(prevReadingRaw);
  const currentReading  = parseFloat(currReadingRaw);
  const ratePerKwh      = parseFloat(rateRaw);

  if (isNaN(previousReading) || previousReading < 0)
    return { error: "La lectura anterior debe ser un número >= 0." };
  if (isNaN(currentReading) || currentReading < 0)
    return { error: "La lectura actual debe ser un número >= 0." };
  if (currentReading < previousReading)
    return { error: "La lectura actual no puede ser menor que la anterior." };
  if (isNaN(ratePerKwh) || ratePerKwh <= 0)
    return { error: "La tarifa por kWh debe ser mayor a $0." };

  const readingDate = Math.floor(new Date(readingDateStr + "T12:00:00").getTime() / 1000);
  const now         = Math.floor(Date.now() / 1000);

  const db = await getTenantDb(slug);
  await db.insert(tenantSchema.energyReadings).values({
    id:              crypto.randomUUID(),
    unitId,
    meterNumber,
    previousReading,
    currentReading,
    ratePerKwh,
    readingDate,
    createdBy:       userId,
    createdAt:       now,
  });

  revalidatePath(`/e/${slug}/energia`);
  return { success: true };
}

// ─── Facturar lectura (genera cargo de energía) ───────────────────────────────
export async function generateChargeFromReading(
  slug: string,
  readingId: string
): Promise<{ error?: string }> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  const reading = await db
    .select()
    .from(tenantSchema.energyReadings)
    .where(eq(tenantSchema.energyReadings.id, readingId))
    .get();

  if (!reading)          return { error: "Lectura no encontrada." };
  if (reading.chargeId)  return { error: "Esta lectura ya fue facturada." };

  const consumption = reading.currentReading - reading.previousReading;
  const amount      = Math.round(consumption * reading.ratePerKwh);

  if (amount <= 0) return { error: "El consumo es 0 kWh — no se puede generar cargo." };

  const now        = Math.floor(Date.now() / 1000);
  const chargeId   = crypto.randomUUID();

  // Crear cargo de tipo "energy"
  await db.insert(tenantSchema.charges).values({
    id:          chargeId,
    unitId:      reading.unitId,
    concept:     "energy",
    description: `Consumo ${consumption.toFixed(2)} kWh × $${reading.ratePerKwh.toLocaleString("es-CO")}/kWh`,
    amount,
    dueDate:     now + 15 * 24 * 60 * 60, // vence en 15 días
    status:      "pending",
    isMass:      0,
    createdBy:   userId,
    createdAt:   now,
    updatedAt:   now,
  });

  // Vincular cargo a la lectura
  await db
    .update(tenantSchema.energyReadings)
    .set({ chargeId })
    .where(eq(tenantSchema.energyReadings.id, readingId));

  revalidatePath(`/e/${slug}/energia`);
  revalidatePath(`/e/${slug}/finanzas`);
  revalidatePath(`/e/${slug}/dashboard`);
  return {};
}

// ─── Eliminar lectura (solo si no facturada) ──────────────────────────────────
export async function deleteReading(slug: string, readingId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  const reading = await db
    .select({ chargeId: tenantSchema.energyReadings.chargeId })
    .from(tenantSchema.energyReadings)
    .where(eq(tenantSchema.energyReadings.id, readingId))
    .get();

  if (reading?.chargeId) return; // ya facturada — no eliminar

  await db
    .delete(tenantSchema.energyReadings)
    .where(eq(tenantSchema.energyReadings.id, readingId));

  revalidatePath(`/e/${slug}/energia`);
}
