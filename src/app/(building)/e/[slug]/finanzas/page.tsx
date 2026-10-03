import { requireAccesoPanelPagina } from "@/lib/auth/helpers";
import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getSuperadminDb } from "@/lib/db/superadmin";
import * as saSchema from "@/lib/db/schema/superadmin";
import { eq, desc, sql, isNotNull } from "drizzle-orm";
import { estadoEfectivo } from "@/lib/cartera/saldo";
import FinanzasClient from "./FinanzasClient";
import type { ChargeWithUnit, KPIs, PendingReviewPayment, BankMovementRow, ChargeMatchCandidate, PaymentRow } from "./types";

export default async function FinanzasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAccesoPanelPagina(slug);
  await requireModule(slug, "finanzas");

  const db  = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);

  const saDb    = getSuperadminDb();
  const building = await saDb
    .select({ name: saSchema.buildings.name, nit: saSchema.buildings.nit, city: saSchema.buildings.city })
    .from(saSchema.buildings)
    .where(eq(saSchema.buildings.slug, slug))
    .get();

  const [charges, units, paymentSums, residents, unverifiedPayments, bankMovementsRaw, matchedMovementIds, allPayments] = await Promise.all([
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
    db.select().from(tenantSchema.payments)
      .where(eq(tenantSchema.payments.bankStatus, "unverified"))
      .orderBy(desc(tenantSchema.payments.createdAt)),
    db.select().from(tenantSchema.bankMovements)
      .orderBy(desc(tenantSchema.bankMovements.date))
      .limit(200),
    db.select({ matchedMovementId: tenantSchema.payments.matchedMovementId })
      .from(tenantSchema.payments)
      .where(isNotNull(tenantSchema.payments.matchedMovementId)),
    db.select().from(tenantSchema.payments).orderBy(desc(tenantSchema.payments.createdAt)),
  ]);

  // Aliases de referencia → unidad (la tabla puede no existir aún en tenants viejos)
  let refAliases: { reference: string; unitId: string }[] = [];
  try {
    refAliases = await db
      .select({ reference: tenantSchema.paymentReferences.reference, unitId: tenantSchema.paymentReferences.unitId })
      .from(tenantSchema.paymentReferences);
  } catch { refAliases = []; }

  const unitMap    = Object.fromEntries(units.map((u) => [u.id, u.number]));
  const paymentMap = Object.fromEntries(paymentSums.map((p) => [p.chargeId, p.total]));
  const residentNameById = Object.fromEntries(residents.map((r) => [r.id, r.name]));

  const chargesWithUnit: ChargeWithUnit[] = charges.map((c) => {
    const paidAmount = paymentMap[c.id] ?? 0;
    // El estado vencido se deriva en lib/cartera/saldo.ts — misma definición que
    // usan el portal del residente y el agente de cartera. Antes se calculaba
    // aquí y en el portal por separado, y las dos vistas no coincidían.
    const effectiveStatus = estadoEfectivo(c, now);
    return {
      id:              c.id,
      unitId:          c.unitId,
      unitNumber:      unitMap[c.unitId] ?? "?",
      concept:         c.concept,
      specificConcept: c.specificConcept ?? null,
      description:     c.description ?? null,
      reference:       c.reference ?? null,
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

  const pendingPayments: PendingReviewPayment[] = unverifiedPayments.map((p) => ({
    id:          p.id,
    unitId:      p.unitId,
    unitNumber:  unitMap[p.unitId] ?? "?",
    amount:      p.amount,
    paymentDate: p.paymentDate,
    reference:   p.reference ?? null,
    receiptUrl:  p.receiptUrl ?? null,
    notes:       p.notes ?? null,
    createdAt:   p.createdAt,
    reportedByName:  p.reportedByUserId ? (residentNameById[p.reportedByUserId] ?? null) : null,
    reportedByPhone: p.reportedByPhone ?? null,
  }));

  // ─── Sugerir unidad por coincidencia exacta de saldo pendiente ────────────
  // Para movimientos bancarios aún no vinculados a ningún pago, se buscan
  // cargos pendientes cuyo saldo restante coincida EXACTO con el monto del
  // movimiento — así se puede identificar de qué unidad es un pago aunque
  // nadie lo haya reportado por WhatsApp ni manualmente.
  const matchedSet = new Set(matchedMovementIds.map((p) => p.matchedMovementId));
  const openCharges = chargesWithUnit.filter((c) => c.effectiveStatus !== "paid");

  // Aliases: reference (MAYÚSCULAS) → set de unitIds
  const aliasByRef = new Map<string, Set<string>>();
  for (const a of refAliases) {
    const key = a.reference.toUpperCase();
    if (!aliasByRef.has(key)) aliasByRef.set(key, new Set());
    aliasByRef.get(key)!.add(a.unitId);
  }
  const aliasEntries = [...aliasByRef.entries()];

  const toCand = (c: ChargeWithUnit): ChargeMatchCandidate => ({
    chargeId: c.id, unitId: c.unitId, unitNumber: c.unitNumber, concept: c.concept,
    reference: c.reference ?? null,
    remaining: c.amount - c.paidAmount,
  });

  const bankMovements: BankMovementRow[] = bankMovementsRaw.map((m) => {
    const matched = matchedSet.has(m.id);
    const candidates: ChargeMatchCandidate[] = matched ? [] : openCharges
      .filter((c) => Math.abs((c.amount - c.paidAmount) - m.amount) < 1)
      .map(toCand);

    // Match por alias de referencia: si el identificador aparece en la
    // referencia o descripción del movimiento, se reconoce su(s) unidad(es).
    let referenceUnits: string[] = [];
    let referenceCharges: ChargeMatchCandidate[] = [];
    if (!matched) {
      const hay = `${m.reference} ${m.description}`.toUpperCase();
      const unitIds = new Set<string>();
      for (const [ref, ids] of aliasEntries) {
        if (hay.includes(ref)) ids.forEach((id) => unitIds.add(id));
      }
      if (unitIds.size > 0) {
        referenceUnits = [...unitIds].map((id) => unitMap[id] ?? "?").sort();
        referenceCharges = openCharges.filter((c) => unitIds.has(c.unitId)).map(toCand);
      }
    }

    return {
      id: m.id, date: m.date, amount: m.amount, reference: m.reference, description: m.description,
      matched, candidates, referenceUnits, referenceCharges,
    };
  });

  // ─── Listado completo de pagos (para agregar/editar/eliminar) ────────────
  const chargeById = Object.fromEntries(charges.map((c) => [c.id, c]));
  const payments: PaymentRow[] = allPayments.map((p) => {
    const charge = chargeById[p.chargeId];
    return {
      id:           p.id,
      chargeId:     p.chargeId,
      unitId:       p.unitId,
      unitNumber:   unitMap[p.unitId] ?? "?",
      concept:      charge?.concept ?? "other",
      chargeAmount: charge?.amount ?? 0,
      amount:       p.amount,
      paymentDate:  p.paymentDate,
      method:       p.method,
      reference:    p.reference ?? null,
      notes:        p.notes ?? null,
      receiptUrl:   p.receiptUrl ?? null,
      bankStatus:   p.bankStatus,
      createdAt:    p.createdAt,
    };
  });

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
        pendingPayments={pendingPayments}
        bankMovements={bankMovements}
        payments={payments}
      />
    </div>
  );
}
