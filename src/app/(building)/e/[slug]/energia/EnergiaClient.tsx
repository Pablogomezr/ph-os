"use client";

import {
  useActionState, useState, useTransition, useEffect, useRef, useMemo,
} from "react";
import {
  createReading, generateChargeFromReading, deleteReading,
  type ReadingFormState,
} from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Zap, Plus, Trash2, Loader2, Receipt, Activity, Clock, CheckCircle2,
} from "lucide-react";
import type { ReadingWithUnit, EnergyKPIs, LastReadingMap, Unit } from "./types";

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
function getToday() {
  return new Date().toISOString().split("T")[0];
}

const inputCls =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({ label, htmlFor, children, hint }: {
  label: string; htmlFor: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── NuevaLecturaSheet ────────────────────────────────────────────────────────
function NuevaLecturaSheet({ open, onClose, units, lastReadings, formAction, state, isPending }: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  lastReadings: LastReadingMap;
  formAction: (p: FormData) => void;
  state: ReadingFormState;
  isPending: boolean;
}) {
  const [selectedUnit, setSelectedUnit] = useState("");
  const [prevReading,  setPrevReading]  = useState("0");
  const [currReading,  setCurrReading]  = useState("");
  const [rate,         setRate]         = useState("800"); // tarifa por defecto COP/kWh

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setSelectedUnit(""); setPrevReading("0"); setCurrReading(""); setRate("800");
    }
  }, [open]);

  // Auto-llenar lectura anterior al seleccionar unidad
  function handleUnitChange(unitId: string) {
    setSelectedUnit(unitId);
    const last = lastReadings[unitId];
    setPrevReading(last !== undefined ? String(last) : "0");
  }

  // Calcular consumo y monto estimado en vivo
  const consumption = useMemo(() => {
    const c = parseFloat(currReading);
    const p = parseFloat(prevReading);
    if (isNaN(c) || isNaN(p) || c < p) return null;
    return c - p;
  }, [currReading, prevReading]);

  const estimatedAmount = useMemo(() => {
    const r = parseFloat(rate);
    if (consumption === null || isNaN(r) || r <= 0) return null;
    return Math.round(consumption * r);
  }, [consumption, rate]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nueva Lectura</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Registra la lectura del medidor de energía.
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
              <select
                id="unitId" name="unitId" required className={inputCls}
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                <option value="">Seleccionar unidad…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.number} — {u.type === "apartment" ? "Apto" : u.type === "office" ? "Oficina" : "Local"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Número de medidor" htmlFor="meterNumber">
              <input
                id="meterNumber" name="meterNumber" type="text"
                placeholder="Ej. MED-101-A" className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Lectura anterior (kWh) *" htmlFor="previousReading">
                <input
                  id="previousReading" name="previousReading" type="number"
                  min="0" step="0.01" required className={inputCls}
                  value={prevReading}
                  onChange={(e) => setPrevReading(e.target.value)}
                />
              </Field>
              <Field label="Lectura actual (kWh) *" htmlFor="currentReading">
                <input
                  id="currentReading" name="currentReading" type="number"
                  min="0" step="0.01" required className={inputCls}
                  value={currReading}
                  onChange={(e) => setCurrReading(e.target.value)}
                  placeholder="1250.50"
                />
              </Field>
            </div>

            <Field
              label="Tarifa (COP/kWh) *"
              htmlFor="ratePerKwh"
              hint="Consulta tu factura de Vatia o la empresa distribuidora."
            >
              <input
                id="ratePerKwh" name="ratePerKwh" type="number"
                min="1" step="1" required className={inputCls}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </Field>

            <Field label="Fecha de lectura *" htmlFor="readingDate">
              <input
                id="readingDate" name="readingDate" type="date"
                required defaultValue={getToday()} className={inputCls}
              />
            </Field>

            {/* Vista previa del consumo */}
            {consumption !== null && consumption >= 0 && (
              <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-[#22D3EE] uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Cálculo estimado
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Consumo</p>
                    <p className="font-bold text-foreground tabular-nums">{consumption.toFixed(2)} kWh</p>
                  </div>
                  {estimatedAmount !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Monto a facturar</p>
                      <p className="font-bold text-[#22D3EE] tabular-nums">{formatCOP(estimatedAmount)}</p>
                    </div>
                  )}
                </div>
                {consumption === 0 && (
                  <p className="text-xs text-[#F59E0B]">⚠ Consumo 0 kWh — no se podrá generar cargo.</p>
                )}
              </div>
            )}
            {consumption !== null && consumption < 0 && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-lg">
                La lectura actual no puede ser menor que la anterior.
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
                ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
                : "Guardar lectura"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EnergiaClient({
  slug, readings, units, lastReadings, kpis,
}: {
  slug: string;
  readings: ReadingWithUnit[];
  units: Unit[];
  lastReadings: LastReadingMap;
  kpis: EnergyKPIs;
}) {
  const [openNuevaLectura, setOpenNuevaLectura] = useState(false);
  const [filterBilled,     setFilterBilled]     = useState<"all" | "billed" | "unbilled">("all");
  const [billingId,        setBillingId]         = useState<string | null>(null);
  const [deletingId,       setDeletingId]        = useState<string | null>(null);
  const [isPendingBill,    startBillTransition]  = useTransition();
  const [isPendingDelete,  startDeleteTransition] = useTransition();

  const [state, formAction, isPending] =
    useActionState<ReadingFormState, FormData>(createReading.bind(null, slug), null);

  const handledRef = useRef<ReadingFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      setOpenNuevaLectura(false);
    }
  }, [state]);

  const filteredReadings = useMemo(() => {
    if (filterBilled === "billed")   return readings.filter((r) =>  r.isBilled);
    if (filterBilled === "unbilled") return readings.filter((r) => !r.isBilled);
    return readings;
  }, [readings, filterBilled]);

  function handleBill(readingId: string) {
    setBillingId(readingId);
    startBillTransition(async () => {
      const res = await generateChargeFromReading(slug, readingId);
      if (res?.error) alert(res.error);
      setBillingId(null);
    });
  }

  function handleDelete(readingId: string) {
    if (!confirm("¿Eliminar esta lectura? Solo es posible si no ha sido facturada.")) return;
    setDeletingId(readingId);
    startDeleteTransition(async () => {
      await deleteReading(slug, readingId);
      setDeletingId(null);
    });
  }

  const FILTERS: { v: "all" | "billed" | "unbilled"; label: string }[] = [
    { v: "all",      label: "Todas" },
    { v: "unbilled", label: "Sin facturar" },
    { v: "billed",   label: "Facturadas" },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Energía</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {readings.length} lectura{readings.length !== 1 ? "s" : ""} registrada{readings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpenNuevaLectura(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva lectura
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Total consumido"
          value={`${kpis.totalConsumptionKwh.toFixed(1)} kWh`}
          sub={`${readings.length} lecturas`}
          icon={Zap}
          accent="bg-[#22D3EE]/10 text-[#22D3EE]"
        />
        <KPICard
          label="Total facturado"
          value={formatCOP(kpis.totalBilledAmount)}
          icon={Receipt}
          accent="bg-[#10B981]/10 text-[#10B981]"
        />
        <KPICard
          label="Sin facturar"
          value={`${kpis.unbilledCount} lectura${kpis.unbilledCount !== 1 ? "s" : ""}`}
          sub="Pendientes de cobro"
          icon={Clock}
          accent="bg-[#F59E0B]/10 text-[#F59E0B]"
        />
        <KPICard
          label="Facturadas"
          value={`${kpis.billedCount}`}
          sub="Con cargo generado"
          icon={CheckCircle2}
          accent="bg-[#6366F1]/10 text-[#6366F1]"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg w-fit">
        {FILTERS.map((f) => {
          const count =
            f.v === "all"
              ? readings.length
              : f.v === "billed"
              ? readings.filter((r) => r.isBilled).length
              : readings.filter((r) => !r.isBilled).length;
          return (
            <button
              key={f.v}
              onClick={() => setFilterBilled(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filterBilled === f.v
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

      {/* Tabla */}
      {filteredReadings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">
            {readings.length === 0 ? "No hay lecturas registradas" : "Sin lecturas en esta categoría"}
          </p>
          <p className="text-muted-foreground text-sm mb-5">
            {readings.length === 0
              ? "Registra la lectura mensual de cada medidor de energía."
              : "Prueba con otro filtro."}
          </p>
          {readings.length === 0 && (
            <button
              onClick={() => setOpenNuevaLectura(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Primera lectura
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Anterior</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Actual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consumo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReadings.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-foreground">{r.unitNumber}</p>
                    {r.meterNumber && (
                      <p className="text-xs text-muted-foreground">{r.meterNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                    {r.previousReading.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                    {r.currentReading.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-[#22D3EE] tabular-nums">
                      {r.consumption.toFixed(2)} kWh
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCOP(r.estimatedAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {formatDate(r.readingDate)}
                  </td>
                  <td className="px-4 py-3">
                    {r.isBilled ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Facturada
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full w-fit">
                        <Clock className="w-3 h-3" /> Sin facturar
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!r.isBilled && r.consumption > 0 && (
                        <button
                          onClick={() => handleBill(r.id)}
                          disabled={isPendingBill && billingId === r.id}
                          title="Generar cargo"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-[#22D3EE] hover:bg-[#22D3EE]/10 transition-colors disabled:opacity-50"
                        >
                          {isPendingBill && billingId === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Receipt className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {!r.isBilled && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={isPendingDelete && deletingId === r.id}
                          title="Eliminar lectura"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {isPendingDelete && deletingId === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevaLecturaSheet
        open={openNuevaLectura}
        onClose={() => setOpenNuevaLectura(false)}
        units={units}
        lastReadings={lastReadings}
        formAction={formAction}
        state={state}
        isPending={isPending}
      />
    </>
  );
}
