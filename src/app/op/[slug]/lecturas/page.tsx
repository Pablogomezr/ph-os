import { requireOperatorContext } from "@/lib/operator-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { getEnergyRate, getLastReadings, getTodayReadingUnitIds } from "./queries";
import OperatorLecturasClient from "./OperatorLecturasClient";

export default async function OperatorLecturasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireOperatorContext(slug);

  const [centralDb, tenantDb] = [getSuperadminDb(), await getTenantDb(slug)];

  const [building, units, lastReadings, todayDone, energyRate] = await Promise.all([
    centralDb
      .select({ name: superadminSchema.buildings.name })
      .from(superadminSchema.buildings)
      .where(eq(superadminSchema.buildings.slug, slug))
      .get(),
    tenantDb.select().from(tenantSchema.units).orderBy(tenantSchema.units.floor, tenantSchema.units.number),
    getLastReadings(slug),
    getTodayReadingUnitIds(slug),
    getEnergyRate(slug),
  ]);

  return (
    <OperatorLecturasClient
      slug={slug}
      buildingName={building?.name ?? slug}
      operatorName={ctx.user.name}
      units={units}
      lastReadings={lastReadings}
      todayDoneIds={[...todayDone]}
      energyRate={energyRate}
    />
  );
}
