import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { inArray, desc } from "drizzle-orm";
import { Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

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

const CONCEPT_LABELS: Record<string, string> = {
  admin_fee: "Cuota de administración", ordinary: "Cuota ordinaria",
  extraordinary: "Cuota extraordinaria", energy: "Energía",
  water: "Agua", gas: "Gas", parking: "Parqueadero",
  penalty: "Multa / Sanción", other: "Otro",
};

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-[#F59E0B]/10 text-[#F59E0B]", icon: Clock },
  partial: { label: "Pago parcial", color: "bg-[#22D3EE]/10 text-[#22D3EE]", icon: Clock },
  paid:    { label: "Pagado",    color: "bg-[#10B981]/10 text-[#10B981]", icon: CheckCircle2 },
  overdue: { label: "Vencido",   color: "bg-[#EF4444]/10 text-[#EF4444]", icon: AlertTriangle },
} as const;

export default async function MisCargosPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db  = await getTenantDb(slug);

  const charges = ctx.unitIds.length
    ? await db.select().from(tenantSchema.charges)
        .where(inArray(tenantSchema.charges.unitId, ctx.unitIds))
        .orderBy(desc(tenantSchema.charges.dueDate))
    : [];

  // KPIs
  const totalPending = charges
    .filter((c) => c.status !== "paid")
    .reduce((s, c) => s + c.amount, 0);
  const totalPaid = charges
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount, 0);
  const overdueCount = charges.filter((c) => c.status === "overdue").length;

  // Agrupar
  const pending = charges.filter((c) => c.status === "pending" || c.status === "partial");
  const overdue = charges.filter((c) => c.status === "overdue");
  const paid    = charges.filter((c) => c.status === "paid");

  function ChargeTable({ items, title, accentColor }: {
    items: typeof charges; title: string; accentColor: string
  }) {
    if (items.length === 0) return null;
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className={`px-5 py-3 border-b border-border flex items-center gap-2`}>
          <span className={`w-2 h-2 rounded-full ${accentColor}`} />
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} cargo{items.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((c) => {
            const s = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const SIcon = s.icon;
            return (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {CONCEPT_LABELS[c.concept] ?? c.concept}
                    {c.description ? <span className="text-muted-foreground font-normal"> — {c.description}</span> : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vence: {formatDate(c.dueDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{formatCOP(c.amount)}</p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${s.color}`}>
                    <SIcon className="w-2.5 h-2.5" />{s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis cargos</h1>
        <p className="text-muted-foreground text-sm mt-1">Historial de cargos de tu unidad</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Saldo pendiente</p>
          <p className="text-lg font-bold text-[#EF4444] tabular-nums">{formatCOP(totalPending)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total pagado</p>
          <p className="text-lg font-bold text-[#10B981] tabular-nums">{formatCOP(totalPaid)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Vencidos</p>
          <p className="text-lg font-bold text-[#F59E0B] tabular-nums">{overdueCount}</p>
        </div>
      </div>

      {charges.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tienes cargos registrados.</p>
        </div>
      ) : (
        <>
          <ChargeTable items={overdue}  title="Cargos vencidos"   accentColor="bg-[#EF4444]" />
          <ChargeTable items={pending}  title="Cargos pendientes" accentColor="bg-[#F59E0B]" />
          <ChargeTable items={paid}     title="Pagados"           accentColor="bg-[#10B981]" />
        </>
      )}

      {/* Nota */}
      <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-xl p-4 text-xs text-muted-foreground">
        💡 Para registrar un pago, comunícate con la administración del edificio o visita la oficina de administración.
      </div>
    </div>
  );
}
