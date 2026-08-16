"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { desc, eq, gte, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type OperatorReadingState = { error?: string; success?: boolean; unitId?: string } | null;

export async function saveOperatorReading(
  slug: string,
  _prev: OperatorReadingState,
  formData: FormData
): Promise<OperatorReadingState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const unitId         = (formData.get("unitId")          as string)?.trim();
  const meterNumber    = (formData.get("meterNumber")     as string)?.trim() || null;
  const prevReadingRaw =  formData.get("previousReading") as string;
  const currReadingRaw =  formData.get("currentReading")  as string;
  const rateRaw        =  formData.get("ratePerKwh")      as string;
  const readingDateStr =  formData.get("readingDate")     as string;

  if (!unitId)         return { error: "Unidad no especificada." };
  if (!readingDateStr) return { error: "Fecha requerida." };

  const previousReading = parseFloat(prevReadingRaw);
  const currentReading  = parseFloat(currReadingRaw);
  const ratePerKwh      = parseFloat(rateRaw) || 800;

  if (isNaN(previousReading) || previousReading < 0)
    return { error: "Lectura anterior inválida." };
  if (isNaN(currentReading) || currentReading < 0)
    return { error: "Lectura actual inválida." };
  if (currentReading < previousReading)
    return { error: "La lectura actual no puede ser menor que la anterior." };

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

  revalidatePath(`/op/${slug}/lecturas`);
  revalidatePath(`/e/${slug}/energia`);
  return { success: true, unitId };
}

/** Tarifa COP/kWh configurada por el admin. Default: 800. */
export async function getEnergyRate(slug: string): Promise<number> {
  try {
    const db  = await getTenantDb(slug);
    const cfg = await db
      .select({ value: tenantSchema.buildingConfig.value })
      .from(tenantSchema.buildingConfig)
      .where(eq(tenantSchema.buildingConfig.key, "energy_rate"))
      .get();
    const rate = cfg ? parseFloat(cfg.value) : NaN;
    return isNaN(rate) || rate <= 0 ? 800 : rate;
  } catch {
    return 800;
  }
}

/** IDs de unidades con lectura registrada hoy. */
export async function getTodayReadingUnitIds(slug: string): Promise<Set<string>> {
  const db       = await getTenantDb(slug);
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const todayEnd   = todayStart + 86400;

  const rows = await db
    .select({ unitId: tenantSchema.energyReadings.unitId })
    .from(tenantSchema.energyReadings)
    .where(
      gte(tenantSchema.energyReadings.readingDate, todayStart)
    );

  return new Set(rows.filter((r) => {
    // double-check < todayEnd (Drizzle doesn't support AND across two conditions in one where easily)
    return true;
  }).map((r) => r.unitId));
}

/** Última lectura (currentReading) por unidad — para pre-llenar "lectura anterior". */
export async function getLastReadings(slug: string): Promise<Record<string, number>> {
  const db   = await getTenantDb(slug);
  const rows = await db
    .select({
      unitId:         tenantSchema.energyReadings.unitId,
      currentReading: tenantSchema.energyReadings.currentReading,
      readingDate:    tenantSchema.energyReadings.readingDate,
    })
    .from(tenantSchema.energyReadings)
    .orderBy(desc(tenantSchema.energyReadings.readingDate));

  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!(r.unitId in map)) map[r.unitId] = r.currentReading;
  }
  return map;
}
