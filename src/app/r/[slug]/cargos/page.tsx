import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { inArray, desc } from "drizzle-orm";
import { Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import {
  estadoEfectivo, saldoDeCargo, pagosPorCargo, formatearCOP,
  type CargoParaSaldo,
} from "@/lib/cartera/saldo";

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

/** Un cargo ya resuelto contra sus pagos, listo para pintar. */
type CargoVista = CargoParaSaldo & {
  concept: string;
  description: string | null;
  /** Estado derivado — "overdue" nunca viene de la base. */
  estado: string;
  /** Lo que falta por pagar, en pesos enteros. */
  saldo: number;
};

export default async function MisCargosPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db  = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);

  const [charges, pagos] = ctx.unitIds.length
    ? await Promise.all([
        db.select().from(tenantSchema.charges)
          .where(inArray(tenantSchema.charges.unitId, ctx.unitIds))
          .orderBy(desc(tenantSchema.charges.dueDate)),
        db.select({
            chargeId: tenantSchema.payments.chargeId,
            amount:   tenantSchema.payments.amount,
          })
          .from(tenantSchema.payments)
          .where(inArray(tenantSchema.payments.unitId, ctx.unitIds)),
      ])
    : [[], []];

  // Fuente única de verdad — el mismo cálculo que ve la administración y el
  // que usa el agente de cartera para decidir a quién le escribe.
  const pagado = pagosPorCargo(pagos);
  const items: CargoVista[] = charges.map((c) => ({
    ...c,
    estado: estadoEfectivo(c, now),
    saldo:  saldoDeCargo(c, pagado.get(c.id) ?? 0),
  }));

  const totalPending = items.reduce((s, c) => s + c.saldo, 0);
  const totalPaid    = Math.round(pagos.reduce((s, p) => s + p.amount, 0));
  const overdueCount = items.filter((c) => c.estado === "overdue").length;

  const overdue = items.filter((c) => c.estado === "overdue");
  const pending = items.filter((c) => c.estado === "pending" || c.estado === "partial");
  const paid    = items.filter((c) => c.estado === "paid");

  function ChargeTable({ items, title, accentColor }: {
    items: CargoVista[]; title: string; accentColor: string
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
            const s = STATUS_CONFIG[c.estado as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const SIcon = s.icon;
            const abonado = c.estado !== "paid" && c.saldo > 0 && c.saldo < Math.round(c.amount);
            return (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {CONCEPT_LABELS[c.concept] ?? c.concept}
                    {c.description ? <span className="text-muted-foreground font-normal"> — {c.description}</span> : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vence: {formatDate(c.dueDate)}
                    {abonado ? <> · Abonado: {formatearCOP(Math.round(c.amount) - c.saldo)}</> : null}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatearCOP(c.estado === "paid" ? Math.round(c.amount) : c.saldo)}
                  </p>
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
          <p className="text-lg font-bold text-[#EF4444] tabular-nums">{formatearCOP(totalPending)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total pagado</p>
          <p className="text-lg font-bold text-[#10B981] tabular-nums">{formatearCOP(totalPaid)}</p>
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
