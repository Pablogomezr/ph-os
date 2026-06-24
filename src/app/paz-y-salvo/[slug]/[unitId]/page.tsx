import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getSuperadminDb } from "@/lib/db/superadmin";
import * as saSchema from "@/lib/db/schema/superadmin";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import PazYSalvoClient from "./PazYSalvoClient";

export const dynamic = "force-dynamic";

export default async function PazYSalvoPage({
  params,
}: {
  params: Promise<{ slug: string; unitId: string }>;
}) {
  const { slug, unitId } = await params;

  // ── Datos del edificio (DB central) ──────────────────────────────────────────
  const saDb = getSuperadminDb();
  const building = await saDb
    .select({
      name:    saSchema.buildings.name,
      nit:     saSchema.buildings.nit,
      address: saSchema.buildings.address,
      city:    saSchema.buildings.city,
    })
    .from(saSchema.buildings)
    .where(eq(saSchema.buildings.slug, slug))
    .get();

  if (!building) notFound();

  // ── Datos del tenant ──────────────────────────────────────────────────────────
  const db = await getTenantDb(slug);

  const unit = await db
    .select()
    .from(tenantSchema.units)
    .where(eq(tenantSchema.units.id, unitId))
    .get();

  if (!unit) notFound();

  // Cargos activos de la unidad
  const charges = await db
    .select()
    .from(tenantSchema.charges)
    .where(eq(tenantSchema.charges.unitId, unitId));

  // Pagos por cargo
  const paymentSums = await db
    .select({
      chargeId: tenantSchema.payments.chargeId,
      total:    sql<number>`SUM(${tenantSchema.payments.amount})`,
    })
    .from(tenantSchema.payments)
    .groupBy(tenantSchema.payments.chargeId);

  const paymentMap = Object.fromEntries(
    paymentSums.map((p) => [p.chargeId, p.total])
  );

  const now = Math.floor(Date.now() / 1000);

  // Verificar que todos los cargos estén pagados (saldo = 0)
  const hasDebt = charges.some((c) => {
    const paid      = paymentMap[c.id] ?? 0;
    const remaining = c.amount - paid;
    const isOverdue = c.status === "pending" && c.dueDate < now;
    return remaining > 0.01 || isOverdue;
  });

  // Residente / propietario asignado
  const allUsers = await db.select().from(tenantSchema.users);
  const owner = allUsers.find((u) => {
    try {
      const ids: string[] = JSON.parse(u.unitIds);
      return ids.includes(unitId) && (u.role === "owner" || u.role === "resident" || u.role === "tenant" || u.role === "admin");
    } catch { return false; }
  });

  // Desglose de conceptos pagados
  const CONCEPT_LABELS: Record<string, string> = {
    ordinary:      "Cuota Ordinaria de Administración",
    extraordinary: "Cuota Extraordinaria",
    energy:        "Cobro de Energía",
    water:         "Cobro de Agua / Acueducto",
    audit:         "Auditoría",
    other:         "Otros cobros",
  };

  const byConceptMap = new Map<string, { label: string; charged: number; paid: number }>();
  for (const c of charges) {
    const paid = paymentMap[c.id] ?? 0;
    const prev = byConceptMap.get(c.concept) ?? {
      label:   c.specificConcept ?? CONCEPT_LABELS[c.concept] ?? c.concept,
      charged: 0,
      paid:    0,
    };
    byConceptMap.set(c.concept, {
      label:   prev.label,
      charged: prev.charged + c.amount,
      paid:    prev.paid + paid,
    });
  }

  const concepts = Array.from(byConceptMap.entries()).map(([key, v]) => ({
    key,
    label:   v.label,
    charged: v.charged,
    paid:    v.paid,
    balance: Math.max(0, v.charged - v.paid),
  }));

  return (
    <PazYSalvoClient
      building={building}
      unit={{
        id:     unit.id,
        number: unit.number,
        type:   unit.type,
        floor:  unit.floor,
      }}
      ownerName={owner?.name ?? null}
      hasDebt={hasDebt}
      concepts={concepts}
      issuedAt={now}
    />
  );
}
