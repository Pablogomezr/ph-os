import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getSuperadminDb } from "@/lib/db/superadmin";
import * as saSchema from "@/lib/db/schema/superadmin";
import { eq, desc, sql } from "drizzle-orm";
import FinanzasClient from "./FinanzasClient";
import type { ChargeWithUnit, KPIs } from "./types";

export default async function FinanzasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "finanzas");

  const db  = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);

  const saDb    = getSuperadminDb();
  const building = await saDb
    .select({ name: saSchema.buildings.name, nit: saSchema.buildings.nit, city: saSchema.buildings.city })
    .from(saSchema.buildings)
    .where(eq(saSchema.buildings.slug, slug))
    .get();

  const [charges, units, paymentSums, residents] = await Promise.all([
    db.select().from(tenantSchema.charges).orderBy(desc(tenantSchema.charges.createdAt)),
    db.select().from(tenantSchema.units),
    db
      .select({
        chargeId: tenantSchema.payments.chargeId,
        total:    sql<number>`SUM(${tenantSchema.payments.amount})`,
      })
      .from(tenantSchema.payments)
      .groupBy(tenantSchema.payments.chargeId),
    db.select().from(tenantSchema.users),
  ]);

  const unitMap    = Object.fromEntries(units.map((u) => [u.id, u.number]));
  const paymentMap = Object.fromEntries(paymentSums.map((p) => [p.chargeId, p.total]));

  const chargesWithUnit: ChargeWithUnit[] = charges.map((c) => {
    const paidAmount      = paymentMap[c.id] ?? 0;
    const isOverdue       = c.status === "pending" && c.dueDate < now;
    const effectiveStatus = isOverdue ? "overdue" : c.status;
    return {
      id:              c.id,
      unitId:          c.unitId,
      unitNumber:      unitMap[c.unitId] ?? "?",
      concept:         c.concept,
      specificConcept: c.specificConcept ?? null,
      description:     c.description ?? null,
      amount:         c.amount,
      dueDate:        c.dueDate,
      status:         c.status,
      effectiveStatus,
      paidAmount,
      isMass:         c.isMass,
      batchId:        c.batchId ?? null,
      createdAt:      c.createdAt,
    };
  });

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const totalExpected  = chargesWithUnit.reduce((s, c) => s + c.amount, 0);
  const totalCollected = chargesWithUnit
    .filter((c) => c.effectiveStatus === "paid")
    .reduce((s, c) => s + c.amount, 0);
  const totalOverdue   = chargesWithUnit
    .filter((c) => c.effectiveStatus === "overdue")
    .reduce((s, c) => s + (c.amount - c.paidAmount), 0);
  const totalPending   = chargesWithUnit
    .filter((c) => c.effectiveStatus === "pending")
    .reduce((s, c) => s + (c.amount - c.paidAmount), 0);
  const collectionRate = totalExpected > 0
    ? Math.round((totalCollected / totalExpected) * 100)
    : 0;

  const kpis: KPIs = {
    totalExpected,
    totalCollected,
    totalPending,
    totalOverdue,
    collectionRate,
  };

  return (
    <div className="p-6 space-y-5">
      <FinanzasClient
        slug={slug}
        buildingName={building?.name ?? slug}
        buildingNit={building?.nit ?? null}
        buildingCity={building?.city ?? null}
        charges={chargesWithUnit}
        units={units}
        residents={residents}
        kpis={kpis}
      />
    </div>
  );
}
