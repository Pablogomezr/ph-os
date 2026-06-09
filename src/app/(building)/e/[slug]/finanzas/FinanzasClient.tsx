"use client";

import {
  useActionState, useState, useTransition, useEffect, useRef, useMemo,
} from "react";
import {
  createCharge, createMassCharges, recordPayment, deleteCharge,
  type ChargeFormState, type MassChargeFormState, type PaymentFormState,
} from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, Trash2, Loader2, CreditCard, DollarSign,
  TrendingUp, AlertTriangle, Zap, Building2, List,
  CheckCircle2, Clock, XCircle, User,
} from "lucide-react";
import type { ChargeWithUnit, KPIs, Unit, ResidentUser } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n);
}
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function getDefaultDueDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

const CONCEPT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ordinary:      { label: "Cuota ordinaria",      color: "text-[#6366F1]",         bg: "bg-[#6366F1]/10" },
  extraordinary: { label: "Cuota extraordinaria", color: "text-[#F59E0B]",         bg: "bg-[#F59E0B]/10" },
  energy:        { label: "Energía",               color: "text-[#22D3EE]",         bg: "bg-[#22D3EE]/10" },
  water:         { label: "Agua / Acueducto",      color: "text-[#3B82F6]",         bg: "bg-[#3B82F6]/10" },
  audit:         { label: "Auditoría",             color: "text-[#8B5CF6]",         bg: "bg-[#8B5CF6]/10" },
  other:         { label: "Otro",                  color: "text-muted-foreground",  bg: "bg-secondary" },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendiente", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  partial: { label: "Parcial",   color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
  paid:    { label: "Pagado",    color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
  overdue: { label: "En mora",   color: "text-[#EF4444]", bg: "bg-[#EF4444]/10" },
};

const inputCls =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({
  label, htmlFor, children,
}: {
  label: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── NuevoCargoSheet ─────────────────────────────────────────────────────────
function NuevoCargoSheet({
  open, onClose, units, formAction, state, isPending,
}: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  formAction: (p: FormData) => void;
  state: ChargeFormState;
  isPending: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nuevo Cargo</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Registra un cargo para una unidad específica.
            </SheetDescription>
          </SheetHeader>
        </div>
        <form action={formAction} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {state.error}
              </div>
            )}
            <Field label="Unidad *" htmlFor="unitId">
              <select id="unitId" name="unitId" required className={inputCls}>
                <option value="">Seleccionar unidad…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.number} — {u.type === "apartment" ? "Apto" : u.type === "office" ? "Oficina" : "Local"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Concepto *" htmlFor="concept">
              <select id="concept" name="concept" defaultValue="ordinary" className={inputCls}>
                {Object.entries(CONCEPT_MAP).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Descripción" htmlFor="description">
              <input
                id="description" name="description" type="text"
                placeholder="Detalle opcional…" className={inputCls}
              />
            </Field>
            <Field label="Monto (COP) *" htmlFor="amount">
              <input
                id="amount" name="amount" type="number" min="1" step="1" required
                placeholder="150000" className={inputCls}
              />
            </Field>
            <Field label="Fecha de vencimiento *" htmlFor="dueDate">
              <input
                id="dueDate" name="dueDate" type="date" required
                defaultValue={getDefaultDueDate()} className={inputCls}
              />
            </Field>
          </div>
          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Crear cargo"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── CobroMasivoSheet ─────────────────────────────────────────────────────────
function CobroMasivoSheet({
  open, onClose, units, formAction, state, isPending,
}: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  formAction: (p: FormData) => void;
  state: MassChargeFormState;
  isPending: boolean;
}) {
  const [amountType, setAmountType] = useState<"fixed" | "coeff">("fixed");
  const [amountValue, setAmountValue] = useState("");

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setAmountType("fixed");
      setAmountValue("");
    }
  }, [open]);

  const preview = useMemo(() => {
    const n = parseFloat(amountValue);
    if (!amountValue || isNaN(n) || n <= 0 || units.length === 0) return null;
    if (amountType === "fixed") {
      return { perUnit: formatCOP(n), total: formatCOP(n * units.length), count: units.length };
    }
    return { perUnit: "variable (por coeficiente)", total: formatCOP(n), count: units.length };
  }, [amountValue, amountType, units]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Cobro Masivo</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Genera cargos para las {units.length} unidades de una sola vez.
            </SheetDescription>
          </SheetHeader>
        </div>
        <form action={formAction} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {state.error}
              </div>
            )}

            <Field label="Concepto *" htmlFor="mass-concept">
              <select id="mass-concept" name="concept" defaultValue="ordinary" className={inputCls}>
                {Object.entries(CONCEPT_MAP).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </Field>

            <Field label="Descripción / Período" htmlFor="mass-description">
              <input
                id="mass-description" name="description" type="text"
                placeholder="Ej. Cuota ordinaria julio 2026" className={inputCls}
              />
            </Field>

            {/* Tipo de monto */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Tipo de monto *</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "fixed", label: "Monto fijo", desc: "Igual para todas" },
                  { v: "coeff", label: "Por coeficiente", desc: "Proporcional al área" },
                ] as const).map((opt) => (
                  <label
                    key={opt.v}
                    className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                      amountType === opt.v
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <input
                      type="radio" name="amountType" value={opt.v}
                      checked={amountType === opt.v}
                      onChange={() => { setAmountType(opt.v); setAmountValue(""); }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {amountType === "fixed" ? (
              <Field label="Monto por unidad (COP) *" htmlFor="fixedAmount">
                <input
                  id="fixedAmount" name="fixedAmount" type="number" min="1" step="1"
                  placeholder="150000" className={inputCls}
                  value={amountValue} onChange={(e) => setAmountValue(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Monto total a distribuir (COP) *" htmlFor="totalAmount">
                <input
                  id="totalAmount" name="totalAmount" type="number" min="1" step="1"
                  placeholder="10000000" className={inputCls}
                  value={amountValue} onChange={(e) => setAmountValue(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se distribuye según el coeficiente de copropiedad de cada unidad.
                </p>
              </Field>
            )}

            <Field label="Fecha de vencimiento *" htmlFor="mass-dueDate">
              <input
                id="mass-dueDate" name="dueDate" type="date" required
                defaultValue={getDefaultDueDate()} className={inputCls}
              />
            </Field>

            {/* Vista previa */}
            {preview && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Vista previa</p>
                <p className="text-sm text-foreground">
                  Se crearán <strong>{preview.count}</strong> cargos
                  {preview.perUnit !== "variable (por coeficiente)" && (
                    <> de <strong>{preview.perUnit}</strong> cada uno</>
                  )}
                </p>
                <p className="text-sm text-foreground">
                  Total: <strong>{preview.total}</strong>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generando…</>
                : `Generar ${units.length} cargos`}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── PagoSheet ────────────────────────────────────────────────────────────────
function PagoSheet({
  open, onClose, charge, formAction, state, isPending,
}: {
  open: boolean;
  onClose: () => void;
  charge: ChargeWithUnit | null;
  formAction: (p: FormData) => void;
  state: PaymentFormState;
  isPending: boolean;
}) {
  if (!charge) return null;

  const remaining = charge.amount - charge.paidAmount;
  const concept   = CONCEPT_MAP[charge.concept] ?? CONCEPT_MAP.other;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Registrar Pago</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Unidad {charge.unitNumber} · {concept.label}
            </SheetDescription>
          </SheetHeader>
        </div>
        <form action={formAction} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Campos ocultos */}
            <input type="hidden" name="chargeId" value={charge.id} />
            <input type="hidden" name="unitId"   value={charge.unitId} />

            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {state.error}
              </div>
            )}

            {/* Resumen del cargo */}
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor del cargo</span>
                <span className="font-medium text-foreground tabular-nums">{formatCOP(charge.amount)}</span>
              </div>
              {charge.paidAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ya pagado</span>
                  <span className="font-medium text-[#10B981] tabular-nums">{formatCOP(charge.paidAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5">
                <span className="text-foreground">Saldo pendiente</span>
                <span className="text-[#F59E0B] tabular-nums">{formatCOP(remaining)}</span>
              </div>
            </div>

            <Field label="Monto del pago (COP) *" htmlFor="pay-amount">
              <input
                id="pay-amount" name="amount" type="number" min="1" step="1" required
                defaultValue={Math.round(remaining).toString()} className={inputCls}
              />
            </Field>

            <Field label="Método de pago *" htmlFor="method">
              <select id="method" name="method" defaultValue="transfer" className={inputCls}>
                <option value="transfer">Transferencia bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="online">PSE / Online</option>
              </select>
            </Field>

            <Field label="Referencia / Comprobante" htmlFor="reference">
              <input
                id="reference" name="reference" type="text"
                placeholder="Nro. comprobante o referencia" className={inputCls}
              />
            </Field>

            <Field label="Notas" htmlFor="pay-notes">
              <input
                id="pay-notes" name="notes" type="text"
                placeholder="Observaciones opcionales" className={inputCls}
              />
            </Field>
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
                : "Registrar pago"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Vista "Por Unidad" ───────────────────────────────────────────────────────
function UnitAccountView({
  units,
  charges,
  residents,
  onViewCharges,
}: {
  units: Unit[];
  charges: ChargeWithUnit[];
  residents: ResidentUser[];
  onViewCharges: (unitId: string) => void;
}) {
  const summaries = useMemo(() => {
    return units.map((unit) => {
      const unitCharges = charges.filter((c) => c.unitId === unit.id);
      const totalCharged = unitCharges.reduce((s, c) => s + c.amount, 0);
      const totalPaid    = unitCharges.reduce((s, c) => s + c.paidAmount, 0);
      const balance      = totalCharged - totalPaid;
      const hasOverdue   = unitCharges.some((c) => c.effectiveStatus === "overdue");
      const hasPending   = unitCharges.some((c) =>
        ["pending", "partial"].includes(c.effectiveStatus)
      );

      // Residentes asignados a esta unidad
      const unitResidents = residents.filter((r) => {
        try {
          const ids: string[] = JSON.parse(r.unitIds);
          return ids.includes(unit.id);
        } catch { return false; }
      });

      type AccountStatus = "clear" | "overdue" | "pending" | "no_charges";
      let status: AccountStatus;
      if (unitCharges.length === 0) status = "no_charges";
      else if (hasOverdue)          status = "overdue";
      else if (balance > 0.01)      status = "pending";
      else                          status = "clear";

      // Desglose por concepto
      const byConceptMap = new Map<string, { charged: number; paid: number }>();
      for (const c of unitCharges) {
        const prev = byConceptMap.get(c.concept) ?? { charged: 0, paid: 0 };
        byConceptMap.set(c.concept, {
          charged: prev.charged + c.amount,
          paid:    prev.paid + c.paidAmount,
        });
      }

      return {
        unit,
        unitResidents,
        totalCharged,
        totalPaid,
        balance,
        status,
        chargesCount: unitCharges.length,
        byConcept: Array.from(byConceptMap.entries()).map(([concept, v]) => ({
          concept,
          charged: v.charged,
          paid:    v.paid,
          balance: v.charged - v.paid,
        })),
      };
    });
  }, [units, charges, residents]);

  const ACCOUNT_STATUS = {
    clear:      { label: "Al día",      color: "text-[#10B981]", bg: "bg-[#10B981]/10", Icon: CheckCircle2 },
    pending:    { label: "Pendiente",   color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", Icon: Clock },
    overdue:    { label: "En mora",     color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", Icon: XCircle },
    no_charges: { label: "Sin cargos", color: "text-muted-foreground", bg: "bg-secondary", Icon: DollarSign },
  };

  if (units.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-foreground font-medium">No hay unidades registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map(({ unit, unitResidents, totalCharged, totalPaid, balance, status, chargesCount, byConcept }) => {
        const s = ACCOUNT_STATUS[status];
        const collRate = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 100) : 0;

        return (
          <div key={unit.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Cabecera de la unidad */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{unit.number}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Unidad {unit.number}
                    <span className="ml-2 text-xs text-muted-foreground font-normal capitalize">
                      {unit.type === "apartment" ? "Apartamento" : unit.type === "office" ? "Oficina" : "Local"}
                    </span>
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {unitResidents.length > 0 ? (
                      unitResidents.map((r) => (
                        <span key={r.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {r.name}
                          <span className={`ml-1 px-1.5 py-0 rounded-full text-[10px] font-medium ${
                            r.role === "admin" ? "bg-[#6366F1]/10 text-[#6366F1]" : "bg-[#22D3EE]/10 text-[#22D3EE]"
                          }`}>
                            {r.role === "admin" ? "Admón." : "Residente"}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sin residente asignado</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Estado */}
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                  <s.Icon className="w-3.5 h-3.5" />
                  {s.label}
                </span>
                {/* Saldo */}
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className={`font-bold tabular-nums text-sm ${balance > 0.01 ? (status === "overdue" ? "text-[#EF4444]" : "text-[#F59E0B]") : "text-[#10B981]"}`}>
                    {formatCOP(balance)}
                  </p>
                </div>
                {/* Ver cargos */}
                {chargesCount > 0 && (
                  <button
                    onClick={() => onViewCharges(unit.id)}
                    className="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors hidden md:block"
                  >
                    Ver cargos
                  </button>
                )}
              </div>
            </div>

            {/* Desglose por concepto */}
            {byConcept.length > 0 ? (
              <div className="divide-y divide-border">
                {byConcept.map(({ concept, charged, paid, balance: bal }) => {
                  const cInfo = CONCEPT_MAP[concept] ?? CONCEPT_MAP.other;
                  const pct   = charged > 0 ? Math.round((paid / charged) * 100) : 0;
                  return (
                    <div key={concept} className="px-5 py-3 flex items-center gap-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cInfo.bg} ${cInfo.color}`}>
                        {cInfo.label}
                      </span>
                      {/* Barra de progreso */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            Pagado {formatCOP(paid)} / {formatCOP(charged)}
                          </span>
                          <span className={`font-medium tabular-nums ${pct === 100 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-[#10B981]" : "bg-[#F59E0B]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {/* Saldo del concepto */}
                      <div className="text-right shrink-0 w-24">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className={`text-sm font-semibold tabular-nums ${bal > 0.01 ? "text-[#F59E0B]" : "text-[#10B981]"}`}>
                          {formatCOP(bal)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {/* Totales de la unidad */}
                <div className="px-5 py-3 bg-secondary/20 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{chargesCount} cargo{chargesCount !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span className="text-[#10B981]">{formatCOP(totalPaid)} pagado</span>
                    {balance > 0.01 && <><span>·</span><span className="text-[#F59E0B]">{formatCOP(balance)} pendiente</span></>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${collRate === 100 ? "bg-[#10B981]" : "bg-primary"}`}
                        style={{ width: `${collRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{collRate}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-center text-sm text-muted-foreground">
                No tiene cargos registrados aún.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FinanzasClient({
  slug, charges, units, residents, kpis,
}: {
  slug: string;
  charges: ChargeWithUnit[];
  units: Unit[];
  residents: ResidentUser[];
  kpis: KPIs;
}) {
  // Tabs principal
  const [activeTab,    setActiveTab]    = useState<"charges" | "byUnit">("charges");
  const [unitFilter,   setUnitFilter]   = useState<string | null>(null);

  // Sheets
  const [openNuevoCargo,  setOpenNuevoCargo]  = useState(false);
  const [openCobroMasivo, setOpenCobroMasivo] = useState(false);
  const [openPago,        setOpenPago]        = useState(false);
  const [selectedCharge,  setSelectedCharge]  = useState<ChargeWithUnit | null>(null);

  // Delete
  const [deletingId,        setDeletingId]        = useState<string | null>(null);
  const [isPendingDelete,   startDeleteTransition] = useTransition();

  // Filtro de estado
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Action states
  const [chargeState, chargeAction, isCreatingCharge] =
    useActionState<ChargeFormState, FormData>(createCharge.bind(null, slug), null);
  const [massState, massAction, isMassCharging] =
    useActionState<MassChargeFormState, FormData>(createMassCharges.bind(null, slug), null);
  const [payState, payAction, isRecordingPayment] =
    useActionState<PaymentFormState, FormData>(recordPayment.bind(null, slug), null);

  // Auto-close por referencia (evita re-cierre en renders)
  const handledChargeRef = useRef<ChargeFormState>(null);
  const handledMassRef   = useRef<MassChargeFormState>(null);
  const handledPayRef    = useRef<PaymentFormState>(null);

  useEffect(() => {
    if (chargeState?.success && chargeState !== handledChargeRef.current) {
      handledChargeRef.current = chargeState;
      setOpenNuevoCargo(false);
    }
  }, [chargeState]);

  useEffect(() => {
    if (massState?.success && massState !== handledMassRef.current) {
      handledMassRef.current = massState;
      setOpenCobroMasivo(false);
    }
  }, [massState]);

  useEffect(() => {
    if (payState?.success && payState !== handledPayRef.current) {
      handledPayRef.current = payState;
      setOpenPago(false);
    }
  }, [payState]);

  // Filtrado (por estado + por unidad si viene de "Por Unidad")
  const filteredCharges = useMemo(() => {
    let result = charges;
    if (unitFilter)       result = result.filter((c) => c.unitId === unitFilter);
    if (filterStatus !== "all") result = result.filter((c) => c.effectiveStatus === filterStatus);
    return result;
  }, [charges, filterStatus, unitFilter]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este cargo? Solo es posible si no tiene pagos registrados.")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deleteCharge(slug, id);
      setDeletingId(null);
    });
  }

  function handleOpenPago(charge: ChargeWithUnit) {
    setSelectedCharge(charge);
    setOpenPago(true);
  }

  function handleViewChargesByUnit(unitId: string) {
    setUnitFilter(unitId);
    setFilterStatus("all");
    setActiveTab("charges");
  }

  function clearUnitFilter() {
    setUnitFilter(null);
  }

  const FILTERS = [
    { v: "all",     label: "Todos" },
    { v: "pending", label: "Pendiente" },
    { v: "overdue", label: "En mora" },
    { v: "partial", label: "Parcial" },
    { v: "paid",    label: "Pagado" },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {charges.length} cargo{charges.length !== 1 ? "s" : ""} registrado{charges.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setOpenCobroMasivo(true)}
            className="flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            Cobro masivo
          </button>
          <button
            onClick={() => setOpenNuevoCargo(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo cargo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Total generado"
          value={formatCOP(kpis.totalExpected)}
          sub={`${charges.length} cargos`}
          icon={DollarSign}
          accent="bg-[#6366F1]/10 text-[#6366F1]"
        />
        <KPICard
          label="Recaudado"
          value={formatCOP(kpis.totalCollected)}
          sub={`${kpis.collectionRate}% de cobranza`}
          icon={TrendingUp}
          accent="bg-[#10B981]/10 text-[#10B981]"
        />
        <KPICard
          label="Pendiente"
          value={formatCOP(kpis.totalPending)}
          icon={CreditCard}
          accent="bg-[#F59E0B]/10 text-[#F59E0B]"
        />
        <KPICard
          label="En mora"
          value={formatCOP(kpis.totalOverdue)}
          icon={AlertTriangle}
          accent="bg-[#EF4444]/10 text-[#EF4444]"
        />
      </div>

      {/* Tab switcher principal */}
      <div className="flex gap-1 border-b border-border">
        {([
          { v: "charges", label: "Todos los cargos", icon: List },
          { v: "byUnit",  label: "Estado por unidad", icon: Building2 },
        ] as const).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => { setActiveTab(v); if (v === "charges") clearUnitFilter(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === v
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Vista "Por Unidad" */}
      {activeTab === "byUnit" && (
        <UnitAccountView
          units={units}
          charges={charges}
          residents={residents}
          onViewCharges={handleViewChargesByUnit}
        />
      )}

      {/* Vista "Todos los cargos" */}
      {activeTab === "charges" && (<>

      {/* Filtro activo por unidad */}
      {unitFilter && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 w-fit">
          <span className="text-xs text-primary font-medium">
            Mostrando cargos de unidad: <strong>{units.find(u => u.id === unitFilter)?.number ?? unitFilter}</strong>
          </span>
          <button
            onClick={clearUnitFilter}
            className="text-xs text-primary hover:text-primary/70 font-semibold ml-1"
          >
            ✕ Quitar filtro
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg w-fit">
        {FILTERS.map((f) => {
          const base  = unitFilter ? charges.filter(c => c.unitId === unitFilter) : charges;
          const count = f.v === "all" ? base.length : base.filter((c) => c.effectiveStatus === f.v).length;
          return (
            <button
              key={f.v}
              onClick={() => setFilterStatus(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filterStatus === f.v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tabla de cargos */}
      {filteredCharges.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">
            {charges.length === 0 ? "No hay cargos registrados" : "Sin cargos en esta categoría"}
          </p>
          <p className="text-muted-foreground text-sm mb-5">
            {charges.length === 0
              ? "Usa el cobro masivo para generar cargos a todas las unidades a la vez."
              : "Prueba seleccionando otro filtro."}
          </p>
          {charges.length === 0 && (
            <button
              onClick={() => setOpenCobroMasivo(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Primer cobro masivo
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Concepto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Vence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCharges.map((c) => {
                const concept = CONCEPT_MAP[c.concept]    ?? CONCEPT_MAP.other;
                const status  = STATUS_MAP[c.effectiveStatus] ?? STATUS_MAP.pending;
                const canPay  = c.effectiveStatus !== "paid";
                const canDel  = c.paidAmount === 0;
                return (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-foreground">{c.unitNumber}</span>
                      {c.isMass === 1 && (
                        <span className="ml-1.5 text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
                          masivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${concept.bg} ${concept.color}`}>
                        {concept.label}
                      </span>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{c.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-foreground tabular-nums">{formatCOP(c.amount)}</p>
                      {c.paidAmount > 0 && c.effectiveStatus !== "paid" && (
                        <p className="text-xs text-[#10B981] tabular-nums">+{formatCOP(c.paidAmount)} pagado</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {formatDate(c.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canPay && (
                          <button
                            onClick={() => handleOpenPago(c)}
                            title="Registrar pago"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDel && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={isPendingDelete && deletingId === c.id}
                            title="Eliminar cargo"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {isPendingDelete && deletingId === c.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {/* Sheets */}
      <NuevoCargoSheet
        open={openNuevoCargo}
        onClose={() => setOpenNuevoCargo(false)}
        units={units}
        formAction={chargeAction}
        state={chargeState}
        isPending={isCreatingCharge}
      />
      <CobroMasivoSheet
        open={openCobroMasivo}
        onClose={() => setOpenCobroMasivo(false)}
        units={units}
        formAction={massAction}
        state={massState}
        isPending={isMassCharging}
      />
      <PagoSheet
        open={openPago}
        onClose={() => setOpenPago(false)}
        charge={selectedCharge}
        formAction={payAction}
        state={payState}
        isPending={isRecordingPayment}
      />
    </>
  );
}
