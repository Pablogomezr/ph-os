"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updatePayment, deletePayment, type PaymentFormState } from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Search, Pencil, Trash2, Loader2, CreditCard, ExternalLink } from "lucide-react";
import type { PaymentRow } from "./types";

const CONCEPT_LABEL: Record<string, string> = {
  ordinary: "Cuota ordinaria", extraordinary: "Cuota extraordinaria",
  energy: "Energía", water: "Agua / Acueducto", audit: "Auditoría", other: "Otro",
};
const METHOD_LABEL: Record<string, string> = {
  transfer: "Transferencia", cash: "Efectivo", online: "PSE / Online",
};
const BANK_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  verified:   { label: "Verificado banco", color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
  manual:     { label: "Aprobado manual",  color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
  unverified: { label: "Sin verificar",    color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
};

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
function toDateInputValue(ts: number) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

const inputCls =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function EditPaymentSheet({ slug, payment, open, onClose }: {
  slug: string; payment: PaymentRow | null; open: boolean; onClose: () => void;
}) {
  const updateBound = updatePayment.bind(null, slug, payment?.id ?? "");
  const [state, formAction, isPending] = useActionState<PaymentFormState, FormData>(updateBound, null);
  const handledRef = useRef<PaymentFormState>(null);

  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      onClose();
    }
  }, [state, onClose]);

  if (!payment) return null;
  const remaining = payment.chargeAmount;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Editar pago</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Unidad {payment.unitNumber} · {CONCEPT_LABEL[payment.concept] ?? "Otro"} · Cargo {formatCOP(remaining)}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form key={payment.id} action={formAction} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {state?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {state.error}
              </div>
            )}

            <Field label="Monto del pago (COP) *" htmlFor="edit-amount">
              <input
                id="edit-amount" name="amount" type="number" min="1" step="1" required
                defaultValue={Math.round(payment.amount).toString()} className={inputCls}
              />
            </Field>

            <Field label="Fecha del pago" htmlFor="paymentDate">
              <input
                id="paymentDate" name="paymentDate" type="date"
                defaultValue={toDateInputValue(payment.paymentDate)} className={inputCls}
              />
            </Field>

            <Field label="Método de pago" htmlFor="edit-method">
              <select id="edit-method" name="method" defaultValue={payment.method} className={inputCls}>
                <option value="transfer">Transferencia bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="online">PSE / Online</option>
              </select>
            </Field>

            <Field label="Referencia / Comprobante" htmlFor="edit-reference">
              <input
                id="edit-reference" name="reference" type="text"
                defaultValue={payment.reference ?? ""}
                placeholder="Nro. comprobante o referencia" className={inputCls}
              />
            </Field>

            <Field label="Notas" htmlFor="edit-notes">
              <input
                id="edit-notes" name="notes" type="text"
                defaultValue={payment.notes ?? ""}
                placeholder="Observaciones opcionales" className={inputCls}
              />
            </Field>

            {payment.receiptUrl && (
              <a href={payment.receiptUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit">
                <ExternalLink className="w-3 h-3" /> Ver comprobante adjunto
              </a>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Guardar cambios"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function PagosView({ slug, payments }: { slug: string; payments: PaymentRow[] }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      p.unitNumber.toLowerCase().includes(q) ||
      (p.reference ?? "").toLowerCase().includes(q) ||
      (CONCEPT_LABEL[p.concept] ?? "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este pago? El cargo asociado volverá a quedar pendiente/parcial según corresponda.")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deletePayment(slug, id);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por unidad, concepto o referencia…"
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">
            {payments.length === 0 ? "No hay pagos registrados" : "Sin resultados"}
          </p>
          <p className="text-muted-foreground text-sm">
            {payments.length === 0 ? "Los pagos que registres o vincules aparecerán aquí." : "Prueba con otro término de búsqueda."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Concepto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Referencia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const bs = BANK_STATUS_STYLE[p.bankStatus] ?? BANK_STATUS_STYLE.unverified;
                return (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{p.unitNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{CONCEPT_LABEL[p.concept] ?? "Otro"}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{formatCOP(p.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">{p.reference || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bs.bg} ${bs.color}`}>{bs.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditing(p)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Editar pago"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={isPendingDelete && deletingId === p.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          title="Eliminar pago"
                        >
                          {isPendingDelete && deletingId === p.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditPaymentSheet slug={slug} payment={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
