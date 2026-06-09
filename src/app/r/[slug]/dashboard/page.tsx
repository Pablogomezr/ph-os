import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { inArray, desc, eq, and } from "drizzle-orm";
import { Receipt, CheckCircle2, MessageSquare, Bell, TrendingDown } from "lucide-react";

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n);
}
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pendiente", color: "bg-[#F59E0B]/10 text-[#F59E0B]" },
  partial:  { label: "Parcial",   color: "bg-[#22D3EE]/10 text-[#22D3EE]" },
  paid:     { label: "Pagado",    color: "bg-[#10B981]/10 text-[#10B981]" },
  overdue:  { label: "Vencido",   color: "bg-[#EF4444]/10 text-[#EF4444]" },
};

const CONCEPT_LABELS: Record<string, string> = {
  admin_fee:    "Cuota admin.",
  ordinary:     "Cuota ordinaria",
  extraordinary:"Extraordinaria",
  energy:       "Energía",
  water:        "Agua",
  gas:          "Gas",
  parking:      "Parqueadero",
  penalty:      "Multa",
  other:        "Otro",
};

export default async function ResidentDashboardPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db  = await getTenantDb(slug);

  const [charges, recentCommunications, allPqrs] = await Promise.all([
    ctx.unitIds.length
      ? db.select().from(tenantSchema.charges)
          .where(inArray(tenantSchema.charges.unitId, ctx.unitIds))
          .orderBy(desc(tenantSchema.charges.createdAt))
      : [],
    db.select().from(tenantSchema.communications)
      .where(and(
        // publishedAt IS NOT NULL
        eq(tenantSchema.communications.publishedAt, tenantSchema.communications.publishedAt)
      ))
      .orderBy(desc(tenantSchema.communications.publishedAt))
      .limit(4),
    ctx.unitIds.length
      ? db.select().from(tenantSchema.pqrs)
          .where(inArray(tenantSchema.pqrs.unitId, ctx.unitIds))
          .orderBy(desc(tenantSchema.pqrs.createdAt))
      : [],
  ]);

  // Filtrar solo publicados
  const comms = recentCommunications.filter((c) => c.publishedAt !== null);

  // KPIs
  const pendingCharges = charges.filter((c) => c.status === "pending" || c.status === "partial" || c.status === "overdue");
  const saldoPendiente = pendingCharges.reduce((s, c) => s + c.amount, 0);
  const openPqrs       = allPqrs.filter((p) => p.status === "open" || p.status === "in_review").length;
  const latestCharge   = charges[0];
  const recentCharges  = charges.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenido, {ctx.user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resumen de tu cuenta en el edificio
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Saldo pendiente */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saldo pendiente</p>
            <div className="p-1.5 rounded-lg bg-[#EF4444]/10"><TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" /></div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{formatCOP(saldoPendiente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingCharges.length} cargos</p>
        </div>
        {/* Total cargos */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total cargos</p>
            <div className="p-1.5 rounded-lg bg-primary/10"><Receipt className="w-3.5 h-3.5 text-primary" /></div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{charges.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {latestCharge ? formatDate(latestCharge.createdAt) : "—"}
          </p>
        </div>
        {/* PQRS abiertos */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PQRS abiertos</p>
            <div className="p-1.5 rounded-lg bg-[#F59E0B]/10"><MessageSquare className="w-3.5 h-3.5 text-[#F59E0B]" /></div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{openPqrs}</p>
          <p className="text-xs text-muted-foreground mt-1">{allPqrs.length} total</p>
        </div>
        {/* Comunicados */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comunicados</p>
            <div className="p-1.5 rounded-lg bg-[#10B981]/10"><Bell className="w-3.5 h-3.5 text-[#10B981]" /></div>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{comms.length}</p>
          <p className="text-xs text-muted-foreground mt-1">publicados</p>
        </div>
      </div>

      {/* Contenido en 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Últimos cargos */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Últimos cargos</p>
            <a href={`/r/${slug}/cargos`} className="text-xs text-primary hover:underline">Ver todos →</a>
          </div>
          {recentCharges.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin cargos registrados</div>
          ) : (
            <div className="divide-y divide-border">
              {recentCharges.map((c) => {
                const s = STATUS_LABELS[c.status] ?? STATUS_LABELS["pending"];
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {CONCEPT_LABELS[c.concept] ?? c.concept}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.dueDate)}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">{formatCOP(c.amount)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comunicados recientes */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Comunicados recientes</p>
            <a href={`/r/${slug}/mensajeria`} className="text-xs text-primary hover:underline">Ver todos →</a>
          </div>
          {comms.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin comunicados publicados</div>
          ) : (
            <div className="divide-y divide-border">
              {comms.map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-0.5 shrink-0">
                      {c.type === "announcement" ? "Aviso" : c.type === "circular" ? "Circular" : "Acta"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{c.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
