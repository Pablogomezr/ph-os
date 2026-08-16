"use client";

import { useActionState, useState, useRef, useMemo, useEffect, useTransition } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Camera, Zap, CheckCircle2, Search, ChevronRight, Loader2,
  AlertTriangle, CheckCircle, Building2, X, ArrowLeft,
} from "lucide-react";
import { saveOperatorReading, type OperatorReadingState } from "./actions";
import type { Unit } from "@/lib/db/schema/tenant";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function formatKwh(n: number) {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

// ─── OCR confidence badge ─────────────────────────────────────────────────────
function ConfidenceBadge({ c }: { c: "high" | "medium" | "low" }) {
  if (c === "high")   return <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3"/>Alta confianza</span>;
  if (c === "medium") return <span className="inline-flex items-center gap-1 text-xs font-medium text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3"/>Verifique el valor</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3"/>Ingrese manualmente</span>;
}

// ─── ReadingSheet (panel deslizante con form) ─────────────────────────────────
function ReadingSheet({
  unit, prevReading, energyRate, slug, onClose, onSaved,
}: {
  unit: Unit; prevReading: number; energyRate: number;
  slug: string; onClose: () => void; onSaved: (unitId: string) => void;
}) {
  const [currReading, setCurrReading] = useState("");
  const [ocrLoading,  setOcrLoading]  = useState(false);
  const [ocrConf,     setOcrConf]     = useState<"high" | "medium" | "low" | null>(null);
  const [ocrError,    setOcrError]    = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] =
    useActionState<OperatorReadingState, FormData>(saveOperatorReading.bind(null, slug), null);

  useEffect(() => {
    if (state?.success && state.unitId) onSaved(state.unitId);
  }, [state]);

  const consumption = useMemo(() => {
    const c = parseFloat(currReading), p = prevReading;
    return !isNaN(c) && c >= p ? c - p : null;
  }, [currReading, prevReading]);

  const estimatedAmount = useMemo(
    () => consumption !== null ? Math.round(consumption * energyRate) : null,
    [consumption, energyRate]
  );

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true); setOcrConf(null); setOcrError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res  = await fetch("/api/energy/ocr", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const data: { reading: number | null; confidence: "high" | "medium" | "low" } = await res.json();
      if (data.reading !== null && !isNaN(data.reading)) {
        setCurrReading(String(data.reading));
        setOcrConf(data.confidence);
      } else {
        setOcrError("No se pudo leer el medidor. Ingrese manualmente.");
        setOcrConf("low");
      }
    } catch {
      setOcrError("Error al analizar la imagen.");
    } finally {
      setOcrLoading(false);
      if (camRef.current) camRef.current.value = "";
    }
  }

  const inputCls = "w-full bg-input border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <p className="font-bold text-foreground text-lg leading-tight">{unit.number}</p>
          <p className="text-xs text-muted-foreground">
            {unit.type === "office" ? "Oficina" : unit.type === "commercial" ? "Local/Garaje" : "Apto"} · Piso {unit.floor ?? "-"}
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col flex-1 overflow-y-auto">
        <input type="hidden" name="unitId"          value={unit.id} />
        <input type="hidden" name="previousReading" value={String(prevReading)} />
        <input type="hidden" name="ratePerKwh"      value={String(energyRate)} />
        <input type="hidden" name="readingDate"     value={getToday()} />

        <div className="p-5 space-y-5 flex-1">
          {/* Error */}
          {state?.error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-xl">
              {state.error}
            </div>
          )}

          {/* Lectura anterior */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Lectura anterior</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{formatKwh(prevReading)} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
          </div>

          {/* Cámara */}
          <div className="space-y-3">
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            <button
              type="button"
              onClick={() => camRef.current?.click()}
              disabled={ocrLoading}
              className="w-full flex items-center justify-center gap-3 bg-primary/10 border-2 border-dashed border-primary/40 text-primary hover:bg-primary/15 disabled:opacity-50 py-4 rounded-xl text-base font-semibold transition-colors"
            >
              {ocrLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" />Analizando…</>
                : <><Camera className="w-5 h-5" />Fotografiar medidor</>}
            </button>
            {ocrConf && !ocrLoading && <ConfidenceBadge c={ocrConf} />}
            {ocrError && !ocrLoading && <p className="text-xs text-destructive">{ocrError}</p>}
          </div>

          {/* Lectura actual */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Lectura actual (kWh) *</label>
            <input
              name="currentReading"
              type="number" inputMode="decimal"
              min="0" step="0.01" required
              className={inputCls}
              value={currReading}
              onChange={(e) => { setCurrReading(e.target.value); setOcrConf(null); }}
              placeholder="Ej: 1 298.00"
            />
          </div>

          {/* N° medidor (opcional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">N° medidor <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <input name="meterNumber" type="text" className={inputCls} placeholder="MED-3A-01" />
          </div>

          {/* Cálculo en vivo */}
          {consumption !== null && consumption >= 0 && (
            <div className="bg-[#22D3EE]/5 border border-[#22D3EE]/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#22D3EE] uppercase tracking-wide flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Cálculo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Consumo</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{formatKwh(consumption)} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                </div>
                {estimatedAmount !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Valor estimado</p>
                    <p className="text-xl font-bold tabular-nums text-[#22D3EE]">{formatCOP(estimatedAmount)}</p>
                  </div>
                )}
              </div>
              {consumption === 0 && <p className="text-xs text-[#F59E0B]">⚠ Consumo 0 kWh — no se generará cargo.</p>}
            </div>
          )}
          {consumption !== null && consumption < 0 && (
            <p className="text-sm text-destructive">La lectura actual no puede ser menor que la anterior.</p>
          )}
        </div>

        {/* Botón guardar */}
        <div className="p-5 border-t border-border bg-card">
          <button
            type="submit"
            disabled={isPending || ocrLoading || !currReading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-xl text-base font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending
              ? <><Loader2 className="w-5 h-5 animate-spin" />Guardando…</>
              : <><CheckCircle2 className="w-5 h-5" />Guardar lectura</>}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OperatorLecturasClient({
  slug, buildingName, operatorName, units, lastReadings, todayDoneIds, energyRate,
}: {
  slug: string;
  buildingName: string;
  operatorName: string;
  units: Unit[];
  lastReadings: Record<string, number>;
  todayDoneIds: string[];
  energyRate: number;
}) {
  const [doneTodaySet, setDoneTodaySet] = useState(() => new Set(todayDoneIds));
  const [selectedUnit, setSelectedUnit]  = useState<Unit | null>(null);
  const [search,       setSearch]        = useState("");

  const filteredUnits = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return units;
    return units.filter((u) => u.number.toLowerCase().includes(q));
  }, [units, search]);

  const doneCount  = doneTodaySet.size;
  const totalCount = units.length;
  const progress   = totalCount > 0 ? doneCount / totalCount : 0;

  function handleSaved(unitId: string) {
    setDoneTodaySet((prev) => new Set([...prev, unitId]));
    setSelectedUnit(null);
  }

  return (
    <>
      {/* Header fijo */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#22D3EE]/15 flex items-center justify-center shrink-0">
            <Zap className="w-4.5 h-4.5 text-[#22D3EE]" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm leading-tight truncate">{buildingName}</p>
            <p className="text-[10px] text-muted-foreground">Portal Operador · {operatorName}</p>
          </div>
        </div>
        <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Progreso del día */}
        <div className="px-4 pt-4 pb-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lecturas de hoy</span>
            <span className="font-bold text-foreground tabular-nums">{doneCount} / {totalCount}</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22D3EE] rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {doneCount === totalCount && totalCount > 0 && (
            <p className="text-xs text-[#10B981] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> ¡Todas las lecturas completadas!
            </p>
          )}
        </div>

        {/* Búsqueda */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar unidad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-input border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Lista de unidades */}
        <div className="px-4 space-y-2 mt-1">
          {filteredUnits.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Sin resultados para &quot;{search}&quot;</p>
          ) : (
            filteredUnits.map((unit) => {
              const done = doneTodaySet.has(unit.id);
              const prev = lastReadings[unit.id] ?? 0;
              return (
                <button
                  key={unit.id}
                  onClick={() => !done && setSelectedUnit(unit)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left ${
                    done
                      ? "bg-[#10B981]/5 border-[#10B981]/20 cursor-default"
                      : "bg-card border-border hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
                  }`}
                >
                  {/* Icono estado */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${done ? "bg-[#10B981]/15" : "bg-secondary"}`}>
                    {done
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-[#10B981]" />
                      : <Camera className="w-4.5 h-4.5 text-muted-foreground" />}
                  </div>

                  {/* Info unidad */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm leading-tight ${done ? "text-muted-foreground" : "text-foreground"}`}>
                      {unit.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {done ? "✓ Leída hoy" : `Anterior: ${formatKwh(prev)} kWh`}
                    </p>
                  </div>

                  {!done && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Panel de lectura */}
      {selectedUnit && (
        <ReadingSheet
          unit={selectedUnit}
          prevReading={lastReadings[selectedUnit.id] ?? 0}
          energyRate={energyRate}
          slug={slug}
          onClose={() => setSelectedUnit(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
