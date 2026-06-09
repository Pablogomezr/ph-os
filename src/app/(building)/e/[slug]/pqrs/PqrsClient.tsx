"use client";

import {
  useActionState, useState, useTransition, useEffect, useRef, useMemo,
} from "react";
import { createPqrs, respondPqrs, deletePqrs } from "./actions";
import type { PqrsWithUnit, PqrsKPIs, Unit, PqrsFormState, PqrsResponseState } from "./types";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, Loader2, Trash2, MessageSquare, CheckCircle2,
  Clock, XCircle, AlertTriangle, FileText,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const inputCls =
  "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

function Field({ label, htmlFor, children }: {
  label: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── Maps ─────────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  petition:   { label: "Petición",    icon: "📋", color: "text-[#22D3EE]",    bg: "bg-[#22D3EE]/10" },
  complaint:  { label: "Queja",       icon: "😤", color: "text-[#F59E0B]",    bg: "bg-[#F59E0B]/10" },
  claim:      { label: "Reclamo",     icon: "⚠️",  color: "text-destructive",  bg: "bg-destructive/10" },
  suggestion: { label: "Sugerencia",  icon: "💡", color: "text-[#10B981]",    bg: "bg-[#10B981]/10" },
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  open:      { label: "Abierto",     color: "text-[#F59E0B]",       bg: "bg-[#F59E0B]/10",    icon: Clock },
  in_review: { label: "En revisión", color: "text-[#22D3EE]",       bg: "bg-[#22D3EE]/10",    icon: MessageSquare },
  resolved:  { label: "Resuelto",    color: "text-[#10B981]",       bg: "bg-[#10B981]/10",    icon: CheckCircle2 },
  closed:    { label: "Cerrado",     color: "text-muted-foreground", bg: "bg-secondary",       icon: XCircle },
};
const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: "Baja",    color: "text-muted-foreground" },
  normal: { label: "Normal",  color: "text-[#22D3EE]" },
  high:   { label: "Alta",    color: "text-[#F59E0B]" },
  urgent: { label: "Urgente", color: "text-destructive" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, accent, warn }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>; accent: string; warn?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${warn && value > 0 ? "border-destructive/30" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className={`text-xl font-bold tabular-nums ${warn && value > 0 ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

// ─── NuevaPqrsSheet ───────────────────────────────────────────────────────────
function NuevaPqrsSheet({ open, onClose, units, formAction, state, isPending }: {
  open: boolean; onClose: () => void; units: Unit[];
  formAction: (p: FormData) => void;
  state: PqrsFormState; isPending: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nueva Solicitud PQRS</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Registra una petición, queja, reclamo o sugerencia.
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo *" htmlFor="type">
                <select id="type" name="type" required className={inputCls}>
                  <option value="">Seleccionar…</option>
                  <option value="petition">📋 Petición</option>
                  <option value="complaint">😤 Queja</option>
                  <option value="claim">⚠️ Reclamo</option>
                  <option value="suggestion">💡 Sugerencia</option>
                </select>
              </Field>
              <Field label="Prioridad" htmlFor="priority">
                <select id="priority" name="priority" defaultValue="normal" className={inputCls}>
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
            </div>
            <Field label="Asunto *" htmlFor="subject">
              <input id="subject" name="subject" type="text" required className={inputCls}
                placeholder="Ej. Ruido excesivo en horas nocturnas" />
            </Field>
            <Field label="Descripción *" htmlFor="description">
              <textarea id="description" name="description" rows={4} required className={inputCls}
                placeholder="Describe detalladamente la situación…" />
            </Field>
          </div>
          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Crear solicitud"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── DetailSheet (Ver / Responder) ────────────────────────────────────────────
function DetailSheet({ item, open, onClose, slug }: {
  item: PqrsWithUnit | null; open: boolean; onClose: () => void; slug: string;
}) {
  const [respState, respAction, respPending] =
    useActionState<PqrsResponseState, FormData>(
      respondPqrs.bind(null, slug), null
    );
  const respHandledRef = useRef<PqrsResponseState>(null);
  useEffect(() => {
    if (respState?.success && respState !== respHandledRef.current) {
      respHandledRef.current = respState;
      onClose();
    }
  }, [respState, onClose]);

  if (!item) return null;

  const tp = TYPE_MAP[item.type]   ?? { label: item.type,   icon: "📋", color: "text-foreground", bg: "bg-secondary" };
  const st = STATUS_MAP[item.status] ?? STATUS_MAP.open;
  const pr = PRIORITY_MAP[item.priority] ?? PRIORITY_MAP.normal;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tp.bg} ${tp.color}`}>
                {tp.icon} {tp.label}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                {st.label}
              </span>
            </div>
            <SheetTitle className="text-foreground text-base leading-snug">{item.subject}</SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              Unidad {item.unitNumber} · {formatDate(item.createdAt)} · Prioridad: <span className={pr.color}>{pr.label}</span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <form action={respAction} className="flex flex-col flex-1 min-h-0">
          <input type="hidden" name="pqrsId" value={item.id} />

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {respState?.error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-lg">
                {respState.error}
              </div>
            )}

            {/* Descripción */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Descripción</p>
              <p className="text-sm text-foreground bg-secondary/40 rounded-lg p-3 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Respuesta existente */}
            {item.response && (
              <div>
                <p className="text-xs font-semibold text-[#10B981] uppercase tracking-wide mb-2">Respuesta registrada</p>
                <p className="text-sm text-foreground bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg p-3 leading-relaxed">
                  {item.response}
                </p>
              </div>
            )}

            {/* Textarea respuesta */}
            <div className="space-y-1.5">
              <label htmlFor="response" className="text-sm font-medium text-foreground">
                {item.response ? "Actualizar respuesta" : "Respuesta"}
              </label>
              <textarea
                id="response" name="response" rows={4} className={inputCls}
                defaultValue={item.response ?? ""}
                placeholder="Escribe la respuesta oficial a esta solicitud…"
              />
            </div>

            {/* Cambiar estado */}
            <div className="space-y-1.5">
              <label htmlFor="status" className="text-sm font-medium text-foreground">Estado</label>
              <select id="status" name="status" defaultValue={item.status} className={inputCls}>
                <option value="open">Abierto</option>
                <option value="in_review">En revisión</option>
                <option value="resolved">Resuelto</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cerrar
            </button>
            <button type="submit" disabled={respPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {respPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Guardar respuesta"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PqrsClient({
  slug, items, units, kpis,
}: {
  slug: string;
  items: PqrsWithUnit[];
  units: Unit[];
  kpis: PqrsKPIs;
}) {
  const [openNueva,    setOpenNueva]    = useState(false);
  const [detailItem,   setDetailItem]   = useState<PqrsWithUnit | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter,   setTypeFilter]   = useState<string>("all");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  // ─── Create PQRS form
  const [createState, createAction, createPending] =
    useActionState<PqrsFormState, FormData>(createPqrs.bind(null, slug), null);
  const createHandledRef = useRef<PqrsFormState>(null);
  useEffect(() => {
    if (createState?.success && createState !== createHandledRef.current) {
      createHandledRef.current = createState;
      setOpenNueva(false);
    }
  }, [createState]);

  // ─── Filtered list
  const filtered = useMemo(() => {
    return items.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchType   = typeFilter   === "all" || p.type   === typeFilter;
      return matchStatus && matchType;
    });
  }, [items, statusFilter, typeFilter]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta solicitud permanentemente?")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deletePqrs(slug, id);
      setDeletingId(null);
    });
  }

  const STATUS_FILTERS = [
    { v: "all",       label: "Todos",       count: items.length },
    { v: "open",      label: "Abiertos",    count: kpis.open },
    { v: "in_review", label: "En revisión", count: kpis.inReview },
    { v: "resolved",  label: "Resueltos",   count: kpis.resolved },
    { v: "closed",    label: "Cerrados",    count: kpis.closed },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PQRS</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} solicitud{items.length !== 1 ? "es" : ""} registrada{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpenNueva(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Total"        value={kpis.total}    icon={FileText}      accent="bg-primary/10 text-primary" />
        <KPICard label="Abiertos"     value={kpis.open}     icon={Clock}         accent="bg-[#F59E0B]/10 text-[#F59E0B]" warn />
        <KPICard label="En revisión"  value={kpis.inReview} icon={MessageSquare} accent="bg-[#22D3EE]/10 text-[#22D3EE]" />
        <KPICard label="Resueltos"    value={kpis.resolved} icon={CheckCircle2}  accent="bg-[#10B981]/10 text-[#10B981]" />
        <KPICard label="Cerrados"     value={kpis.closed}   icon={XCircle}       accent="bg-secondary text-muted-foreground" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Filtro por estado */}
        <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === f.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label} <span className="ml-1 opacity-60 tabular-nums">({f.count})</span>
            </button>
          ))}
        </div>
        {/* Filtro por tipo */}
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="all">Todos los tipos</option>
          <option value="petition">📋 Petición</option>
          <option value="complaint">😤 Queja</option>
          <option value="claim">⚠️ Reclamo</option>
          <option value="suggestion">💡 Sugerencia</option>
        </select>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">
            {items.length === 0 ? "No hay solicitudes PQRS" : "Sin solicitudes en esta categoría"}
          </p>
          <p className="text-muted-foreground text-sm mb-5">
            {items.length === 0 ? "Las peticiones, quejas, reclamos y sugerencias aparecerán aquí." : "Prueba ajustando los filtros."}
          </p>
          {items.length === 0 && (
            <button onClick={() => setOpenNueva(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Primera solicitud
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Solicitud</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Unidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const tp = TYPE_MAP[p.type]     ?? { label: p.type,     icon: "📋", color: "text-foreground", bg: "bg-secondary" };
                const st = STATUS_MAP[p.status] ?? STATUS_MAP.open;
                const pr = PRIORITY_MAP[p.priority] ?? PRIORITY_MAP.normal;
                const StatusIcon = st.icon;
                return (
                  <tr key={p.id}
                    onClick={() => setDetailItem(p)}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${tp.bg} ${tp.color} shrink-0`}>
                          {tp.icon}
                        </span>
                        <div>
                          <p className="font-semibold text-foreground leading-tight">{p.subject}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-sm font-semibold text-foreground">{p.unitNumber}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-semibold ${pr.color}`}>{pr.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${st.bg} ${st.color}`}>
                        <StatusIcon className="w-3 h-3" />{st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDetailItem(p)}
                          className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                        >
                          Ver / Responder
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deletingId === p.id
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

      {/* Sheets */}
      <NuevaPqrsSheet
        open={openNueva}
        onClose={() => setOpenNueva(false)}
        units={units}
        formAction={createAction}
        state={createState}
        isPending={createPending}
      />
      <DetailSheet
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        slug={slug}
      />
    </>
  );
}
