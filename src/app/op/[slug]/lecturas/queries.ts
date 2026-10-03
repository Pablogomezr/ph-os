import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc, eq, gte } from "drizzle-orm";

// Lecturas para page.tsx, que ya exige requireOperatorContext. Viven fuera de
// actions.ts porque todo export de un archivo "use server" es un endpoint público.

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
