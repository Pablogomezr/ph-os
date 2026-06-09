import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import ContabilidadClient, { type ContabilidadSummary } from "./ContabilidadClient";

export default async function ContabilidadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "contabilidad");

  const db = await getTenantDb(slug);

  const [charges, payments] = await Promise.all([
    db.select().from(tenantSchema.charges),
    db.select().from(tenantSchema.payments),
  ]);

  // ─── Calcular KPIs globales ───────────────────────────────────────────────
  const totalCharged   = charges.reduce((s, c) => s + c.amount, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const totalPending   = charges
    .filter((c) => c.status === "pending" || c.status === "partial")
    .reduce((s, c) => s + c.amount, 0);
  const totalOverdue   = charges
    .filter((c) => c.status === "overdue")
    .reduce((s, c) => s + c.amount, 0);

  const collectionRate =
    totalCharged > 0
      ? Math.round((totalCollected / totalCharged) * 100)
      : 0;

  const summary: ContabilidadSummary = {
    totalCharged,
    totalCollected,
    totalPending,
    totalOverdue,
    chargesCount:  charges.length,
    paymentsCount: payments.length,
    collectionRate,
  };

  return (
    <div className="p-6 space-y-5">
      <ContabilidadClient slug={slug} summary={summary} />
    </div>
  );
}
