"use client";

import { useActionState, useTransition, useState, useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  importBankStatement, resolvePendingPayment, linkMovementToCharge, applyPaymentSplit, applyMovementSplit,
  type BankImportState,
} from "./bank-actions";
import {
  UploadCloud, Loader2, CheckCircle2, XCircle, Landmark, FileWarning, Download, Link2, SplitSquareHorizontal, Hash,
} from "lucide-react";
import type { PendingReviewPayment, BankMovementRow, ChargeWithUnit } from "./types";

const CONCEPT_LABEL: Record<string, string> = {
  ordinary: "Cuota ordinaria", extraordinary: "Cuota extraordinaria",
  energy: "Energía", water: "Agua / Acueducto", audit: "Auditoría", other: "Otro",
};

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

function MovementRow({ slug, m, onApplyReference, onAssign }: {
  slug: string; m: BankMovementRow; onApplyReference: (m: BankMovementRow) => void; onAssign: (m: BankMovementRow) => void;
}) {
  const [selectedCharge, setSelectedCharge] = useState(m.candidates[0]?.chargeId ?? "");
  const [isLinking, startLinkTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);

  function handleLink() {
    if (!selectedCharge) return;
    setError(null);
    startLinkTransition(async () => {
      const result = await linkMovementToCharge(slug, m.id, selectedCharge);
      if (result?.error) setError(result.error);
      else setLinked(true);
    });
  }

  const hasRef = m.referenceUnits.length > 0 && m.referenceCharges.length > 0;

  return (
    <tr>
      <td className="px-5 py-2 text-foreground">{formatDate(m.date)}</td>
      <td className="px-5 py-2 text-right font-mono text-foreground">{formatCOP(m.amount)}</td>
      <td className="px-5 py-2 text-muted-foreground">{m.reference || "—"}</td>
      <td className="px-5 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[240px]">{m.description || "—"}</td>
      <td className="px-5 py-2">
        {m.matched || linked ? (
          <span className="flex items-center gap-1 text-xs text-[#10B981]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Conciliado
          </span>
        ) : (
          <div className="space-y-1.5">
            {hasRef && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#22D3EE]/10 text-[#22D3EE]" title="Unidad reconocida por la referencia del pago">
                  <Hash className="w-2.5 h-2.5" /> Ref: {m.referenceUnits.join(", ")}
                </span>
                <button
                  onClick={() => onApplyReference(m)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                >
                  <SplitSquareHorizontal className="w-3 h-3" /> Aplicar
                </button>
              </div>
            )}
            {m.candidates.length > 0 && (
              <div className="flex items-center gap-1.5">
                {m.candidates.length > 1 ? (
                  <select
                    value={selectedCharge}
                    onChange={(e) => setSelectedCharge(e.target.value)}
                    className="bg-input border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {m.candidates.map((c) => (
                      <option key={c.chargeId} value={c.chargeId}>
                        Unidad {c.unitNumber} — {formatCOP(c.remaining)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-foreground font-medium">Unidad {m.candidates[0].unitNumber}</span>
                )}
                <button
                  onClick={handleLink}
                  disabled={isLinking}
                  title="Vincular — coincidencia exacta de valor"
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 transition-colors shrink-0"
                >
                  {isLinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                  Vincular
                </button>
              </div>
            )}
            {/* Asignar manualmente — siempre disponible aunque no haya alias ni coincidencia */}
            <button
              onClick={() => onAssign(m)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              title="Identificar el pago manualmente y asignarlo a una unidad"
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              {!hasRef && m.candidates.length === 0 ? "Sin coincidencia · Asignar manual" : "Asignar a otra unidad"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </td>
    </tr>
  );
}

function MovementSplitSheet({ slug, movement, open, onClose }: {
  slug: string; movement: BankMovementRow | null; open: boolean; onClose: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isApplying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const charges = useMemo(() => movement?.referenceCharges ?? [], [movement]);
  const total = movement?.amount ?? 0;
  const assigned = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const exceeded = assigned > total + 0.01;

  function handleClose() { setAmounts({}); setError(null); onClose(); }
  function handleApply() {
    if (!movement) return;
    const allocations = Object.entries(amounts)
      .map(([chargeId, v]) => ({ chargeId, amount: parseFloat(v) || 0 }))
      .filter((a) => a.amount > 0);
    if (allocations.length === 0) { setError("Ingresa al menos un monto a aplicar."); return; }
    setError(null);
    startApply(async () => {
      const r = await applyMovementSplit(slug, movement.id, allocations);
      if (r?.error) setError(r.error); else handleClose();
    });
  }

  if (!movement) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Aplicar movimiento por referencia</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Movimiento de {formatCOP(total)}{movement.reference ? ` · Ref. ${movement.reference}` : ""} · Unidad(es) {movement.referenceUnits.join(", ")}.
              Reparte el monto entre los cargos pendientes reconocidos.
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div className="border border-border rounded-lg divide-y divide-border">
            {charges.map((c) => (
              <div key={c.chargeId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground font-medium truncate">
                    Unidad {c.unitNumber} · {CONCEPT_LABEL[c.concept] ?? "Otro"}
                    {c.reference ? <span className="ml-1 text-[10px] font-mono text-muted-foreground">({c.reference})</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">Saldo {formatCOP(c.remaining)}</p>
                </div>
                <input
                  type="number" min={0} max={c.remaining} step="1"
                  value={amounts[c.chargeId] ?? ""}
                  onChange={(e) => setAmounts((p) => ({ ...p, [c.chargeId]: e.target.value }))}
                  placeholder="0"
                  className="w-28 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-border bg-card shrink-0 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Asignado</span>
            <span className={`font-mono font-semibold ${exceeded ? "text-destructive" : "text-foreground"}`}>
              {formatCOP(assigned)} de {formatCOP(total)}
            </span>
          </div>
          {exceeded && <p className="text-xs text-destructive">La suma supera el monto del movimiento.</p>}
          <div className="flex gap-3">
            <button type="button" onClick={handleClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleApply} disabled={isApplying || exceeded || assigned <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isApplying ? <><Loader2 className="w-4 h-4 animate-spin" />Aplicando…</> : "Aplicar"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Asignación MANUAL: identificar el pago aunque no haya alias — elegir la
// unidad, repartir el monto entre sus cargos, y opcionalmente recordar la
// referencia para que la próxima vez se reconozca sola.
function MovementAssignSheet({ slug, movement, charges, open, onClose }: {
  slug: string; movement: BankMovementRow | null; charges: ChargeWithUnit[]; open: boolean; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unitSearch, setUnitSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const [isApplying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openCharges = useMemo(() => charges.filter((c) => c.effectiveStatus !== "paid"), [charges]);
  const units = useMemo(() => {
    const map = new Map<string, { unitId: string; unitNumber: string; pend: number }>();
    for (const c of openCharges) {
      const prev = map.get(c.unitId) ?? { unitId: c.unitId, unitNumber: c.unitNumber, pend: 0 };
      prev.pend += c.amount - c.paidAmount;
      map.set(c.unitId, prev);
    }
    return [...map.values()].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));
  }, [openCharges]);
  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => u.unitNumber.toLowerCase().includes(q));
  }, [units, unitSearch]);
  // Cargos de TODAS las unidades seleccionadas, agrupados por unidad
  const selectedGroups = useMemo(() => {
    return units
      .filter((u) => selected.has(u.unitId))
      .map((u) => ({
        unitNumber: u.unitNumber,
        charges: openCharges.filter((c) => c.unitId === u.unitId).sort((a, b) => a.dueDate - b.dueDate),
      }));
  }, [units, selected, openCharges]);

  const total = movement?.amount ?? 0;
  const assigned = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const exceeded = assigned > total + 0.01;

  function toggleUnit(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) { next.delete(uid); } else { next.add(uid); }
      return next;
    });
  }
  function handleClose() { setSelected(new Set()); setUnitSearch(""); setAmounts({}); setRemember(true); setError(null); onClose(); }
  function handleApply() {
    if (!movement) return;
    const allocations = Object.entries(amounts)
      .map(([chargeId, v]) => ({ chargeId, amount: parseFloat(v) || 0 }))
      .filter((a) => a.amount > 0);
    if (allocations.length === 0) { setError("Ingresa al menos un monto a aplicar."); return; }
    setError(null);
    startApply(async () => {
      const r = await applyMovementSplit(slug, movement.id, allocations, remember);
      if (r?.error) setError(r.error); else handleClose();
    });
  }

  if (!movement) return null;
  const inputCls = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Asignar movimiento a unidades</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Movimiento de {formatCOP(total)}{movement.reference ? ` · Ref. ${movement.reference}` : ""}.
              Marca una o varias unidades (para dueños con varias oficinas que pagan junto) y reparte el monto entre las FV de cada una.
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Unidades ({selected.size} seleccionada{selected.size !== 1 ? "s" : ""})</label>
            <input type="text" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)}
              placeholder="Buscar unidad…" className={inputCls} />
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredUnits.map((u) => (
                <label key={u.unitId} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/40 cursor-pointer">
                  <input type="checkbox" checked={selected.has(u.unitId)} onChange={() => toggleUnit(u.unitId)} className="rounded border-border" />
                  <span className="font-medium text-foreground">Unidad {u.unitNumber}</span>
                  <span className="ml-auto text-xs text-muted-foreground">pendiente {formatCOP(u.pend)}</span>
                </label>
              ))}
              {filteredUnits.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin resultados.</p>}
            </div>
          </div>

          {selectedGroups.map((g) => (
            <div key={g.unitNumber} className="space-y-1">
              <p className="text-xs font-semibold text-primary">Unidad {g.unitNumber}</p>
              <div className="border border-border rounded-lg divide-y divide-border">
                {g.charges.map((c) => {
                  const rem = c.amount - c.paidAmount;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground font-medium truncate">
                          {CONCEPT_LABEL[c.concept] ?? "Otro"}
                          {c.reference ? <span className="ml-1 text-[10px] font-mono text-muted-foreground">({c.reference})</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{c.description || "Sin descripción"} · Saldo {formatCOP(rem)}</p>
                      </div>
                      <input type="number" min={0} max={rem} step="1"
                        value={amounts[c.id] ?? ""}
                        onChange={(e) => setAmounts((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="0"
                        className="w-28 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                  );
                })}
                {g.charges.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Sin cargos pendientes.</p>
                )}
              </div>
            </div>
          ))}

          {movement.reference?.trim() && selected.size > 0 && (
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-border" />
              Recordar la referencia «{movement.reference}» para {selected.size === 1 ? "esta unidad" : "estas unidades"} (auto-reconocer próximos pagos).
            </label>
          )}
        </div>
        <div className="p-6 border-t border-border bg-card shrink-0 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Asignado</span>
            <span className={`font-mono font-semibold ${exceeded ? "text-destructive" : "text-foreground"}`}>{formatCOP(assigned)} de {formatCOP(total)}</span>
          </div>
          {exceeded && <p className="text-xs text-destructive">La suma supera el monto del movimiento.</p>}
          <div className="flex gap-3">
            <button type="button" onClick={handleClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={handleApply} disabled={isApplying || exceeded || assigned <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isApplying ? <><Loader2 className="w-4 h-4 animate-spin" />Asignando…</> : "Asignar"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SplitPaymentSheet({ slug, payment, charges, open, onClose }: {
  slug: string;
  payment: PendingReviewPayment | null;
  charges: ChargeWithUnit[];
  open: boolean;
  onClose: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isApplying, startApplyTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unitCharges = useMemo(() => {
    if (!payment) return [];
    return charges
      .filter((c) => c.unitId === payment.unitId && c.effectiveStatus !== "paid")
      .sort((a, b) => a.dueDate - b.dueDate);
  }, [charges, payment]);

  const total = payment?.amount ?? 0;
  const assigned = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remaining = total - assigned;
  const exceeded = assigned > total + 0.01;

  function handleClose() {
    setAmounts({});
    setError(null);
    onClose();
  }

  function handleApply() {
    if (!payment) return;
    const allocations = Object.entries(amounts)
      .map(([chargeId, v]) => ({ chargeId, amount: parseFloat(v) || 0 }))
      .filter((a) => a.amount > 0);
    if (allocations.length === 0) {
      setError("Ingresa al menos un monto a aplicar.");
      return;
    }
    setError(null);
    startApplyTransition(async () => {
      const result = await applyPaymentSplit(slug, payment.id, allocations);
      if (result?.error) setError(result.error);
      else handleClose();
    });
  }

  if (!payment) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Aplicar pago a varios cargos</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Unidad {payment.unitNumber} · Pago de {formatCOP(total)}{payment.reference ? ` · Ref. ${payment.reference}` : ""}
              . Reparte el monto entre los cargos pendientes de esta unidad — útil cuando pagan varios meses juntos.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {unitCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Esta unidad no tiene cargos pendientes.
            </p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {unitCharges.map((c) => {
                const chargeRemaining = c.amount - c.paidAmount;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium truncate">
                        {CONCEPT_LABEL[c.concept] ?? "Otro"}
                        {c.reference ? <span className="text-xs text-muted-foreground font-mono ml-1.5">({c.reference})</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.description || "Sin descripción"} · Saldo {formatCOP(chargeRemaining)}
                      </p>
                    </div>
                    <input
                      type="number" min={0} max={chargeRemaining} step="1"
                      value={amounts[c.id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="0"
                      className="w-28 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-card shrink-0 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Asignado</span>
            <span className={`font-mono font-semibold ${exceeded ? "text-destructive" : "text-foreground"}`}>
              {formatCOP(assigned)} de {formatCOP(total)}
            </span>
          </div>
          {!exceeded && (
            <p className="text-xs text-muted-foreground">Sin asignar: {formatCOP(remaining)}</p>
          )}
          {exceeded && (
            <p className="text-xs text-destructive">La suma supera el monto del pago.</p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={handleClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || exceeded || assigned <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isApplying ? <><Loader2 className="w-4 h-4 animate-spin" />Aplicando…</> : "Aplicar"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ConciliacionView({
  slug, pendingPayments, bankMovements, charges,
}: {
  slug: string;
  pendingPayments: PendingReviewPayment[];
  bankMovements: BankMovementRow[];
  charges: ChargeWithUnit[];
}) {
  const [splitPayment, setSplitPayment] = useState<PendingReviewPayment | null>(null);
  const [applyMovement, setApplyMovement] = useState<BankMovementRow | null>(null);
  const [assignMovement, setAssignMovement] = useState<BankMovementRow | null>(null);
  const [state, formAction, isPending] = useActionState<BankImportState, FormData>(
    importBankStatement.bind(null, slug), null
  );
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [, startResolveTransition] = useTransition();

  function handleResolve(id: string, action: "verify" | "reject") {
    if (action === "reject" && !confirm("¿Rechazar este pago? Se eliminará el registro y el cargo seguirá pendiente.")) return;
    setResolvingId(id);
    startResolveTransition(async () => {
      await resolvePendingPayment(slug, id, action);
      setResolvingId(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Exportar reporte completo */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Reporte de conciliación</p>
          <p className="text-xs text-muted-foreground">
            Resumen, detalle por unidad, top deudores, movimientos bancarios y pendientes — con los datos actuales.
          </p>
        </div>
        <a
          href={`/api/export/${slug}/conciliacion`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Descargar Excel
        </a>
      </div>

      {/* Importar extracto */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Importar extracto bancario</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Sube el extracto (.xlsx, .xls, .csv o .pdf) descargado directamente desde tu banco.
          Los pagos reportados por WhatsApp o registrados manualmente se cruzan
          automáticamente contra estos movimientos para confirmar que la plata
          realmente entró a la cuenta.
        </p>

        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-xs font-medium text-foreground">Archivo</label>
            <input
              type="file" name="file" accept=".xlsx,.xls,.csv,.pdf" required
              className="w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:text-xs file:font-medium hover:file:bg-secondary/80"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Modo</label>
            <select name="mode" defaultValue="agregar"
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="agregar">Agregar nuevos</option>
              <option value="reemplazar">Reemplazar todo</option>
            </select>
          </div>
          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            Importar
          </button>
        </form>

        {state?.error && (
          <p className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-3 text-sm text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg px-3 py-2">
            {state.imported} movimiento(s) importado(s)
            {state.skipped ? ` · ${state.skipped} ya existían y se omitieron` : ""}.
          </p>
        )}
      </div>

      {/* Pagos pendientes de conciliación */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FileWarning className="w-4 h-4 text-[#F59E0B]" />
          <h3 className="font-semibold text-foreground">
            Pendientes de conciliación ({pendingPayments.length})
          </h3>
        </div>
        {pendingPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-8 text-center">
            No hay pagos esperando confirmación contra el banco.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pendingPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Unidad {p.unitNumber} · {formatCOP(p.amount)}
                  </p>
                  {p.reportedByName && (
                    <p className="text-xs text-primary font-medium mt-0.5">
                      Reportado por {p.reportedByName}
                      {p.reportedByPhone ? ` (${p.reportedByPhone})` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(p.paymentDate)}
                    {p.reference ? ` · Ref. ${p.reference}` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.receiptUrl && (
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline">Ver comprobante</a>
                  )}
                  <button
                    onClick={() => handleResolve(p.id, "verify")}
                    disabled={resolvingId === p.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                  </button>
                  <button
                    onClick={() => setSplitPayment(p)}
                    disabled={resolvingId === p.id}
                    title="Repartir este pago entre varios cargos de la unidad"
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                  >
                    <SplitSquareHorizontal className="w-3.5 h-3.5" /> Dividir
                  </button>
                  <button
                    onClick={() => handleResolve(p.id, "reject")}
                    disabled={resolvingId === p.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Últimos movimientos importados */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            Últimos movimientos importados ({bankMovements.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cuando un movimiento coincide exacto con el saldo pendiente de una unidad, se sugiere aquí — revisa y dale "Vincular" para acreditarlo.
          </p>
        </div>
        {bankMovements.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-8 text-center">
            Aún no has importado ningún extracto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-muted-foreground uppercase">Monto</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase">Referencia</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Descripción</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bankMovements.map((m) => (
                <MovementRow key={m.id} slug={slug} m={m} onApplyReference={setApplyMovement} onAssign={setAssignMovement} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SplitPaymentSheet
        slug={slug}
        payment={splitPayment}
        charges={charges}
        open={!!splitPayment}
        onClose={() => setSplitPayment(null)}
      />
      <MovementSplitSheet
        slug={slug}
        movement={applyMovement}
        open={!!applyMovement}
        onClose={() => setApplyMovement(null)}
      />
      <MovementAssignSheet
        slug={slug}
        movement={assignMovement}
        charges={charges}
        open={!!assignMovement}
        onClose={() => setAssignMovement(null)}
      />
    </div>
  );
}
