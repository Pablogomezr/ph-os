import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc } from "drizzle-orm";
import EnergiaClient from "./EnergiaClient";
import type { ReadingWithUnit, EnergyKPIs, LastReadingMap } from "./types";

export default async function EnergiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "energia");

  const db = await getTenantDb(slug);

  const [rawReadings, units] = await Promise.all([
    db
      .select()
      .from(tenantSchema.energyReadings)
      .orderBy(desc(tenantSchema.energyReadings.readingDate)),
    db.select().from(tenantSchema.units),
  ]);

  const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));

  // ─── Construir ReadingWithUnit[] ─────────────────────────────────────────────
  const readings: ReadingWithUnit[] = rawReadings.map((r) => {
    const unit        = unitMap[r.unitId];
    const consumption = r.currentReading - r.previousReading;
    const estimatedAmount = Math.round(consumption * r.ratePerKwh);
    return {
      id:              r.id,
      unitId:          r.unitId,
      unitNumber:      unit?.number ?? "?",
      meterNumber:     r.meterNumber ?? null,
      previousReading: r.previousReading,
      currentReading:  r.currentReading,
      consumption,
      ratePerKwh:      r.ratePerKwh,
      estimatedAmount,
      readingDate:     r.readingDate,
      photoUrl:        r.photoUrl ?? null,
      chargeId:        r.chargeId ?? null,
      isBilled:        !!r.chargeId,
      createdAt:       r.createdAt,
    };
  });

  // ─── LastReadingMap: unitId → último currentReading (más reciente) ───────────
  // rawReadings ya está ordenado por readingDate DESC → primera ocurrencia = más reciente
  const lastReadings: LastReadingMap = {};
  for (const r of rawReadings) {
    if (!(r.unitId in lastReadings)) {
      lastReadings[r.unitId] = r.currentReading;
    }
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const billedReadings   = readings.filter((r) =>  r.isBilled);
  const unbilledReadings = readings.filter((r) => !r.isBilled);

  const kpis: EnergyKPIs = {
    totalConsumptionKwh: readings.reduce((s, r) => s + r.consumption, 0),
    totalBilledAmount:   billedReadings.reduce((s, r) => s + r.estimatedAmount, 0),
    unbilledCount:       unbilledReadings.length,
    billedCount:         billedReadings.length,
  };

  return (
    <div className="p-6 space-y-5">
      <EnergiaClient
        slug={slug}
        readings={readings}
        units={units}
        lastReadings={lastReadings}
        kpis={kpis}
      />
    </div>
  );
}
