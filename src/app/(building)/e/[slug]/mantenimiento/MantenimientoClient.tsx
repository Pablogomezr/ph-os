"use client";

import {
  useActionState, useState, useTransition, useEffect, useRef, useMemo,
} from "react";
import {
  createAsset, updateAssetStatus, deleteAsset,
  createTask,  updateTaskStatus,  deleteTask,
  type AssetFormState, type TaskFormState,
} from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Wrench, Plus, Trash2, Loader2, ClipboardList, CheckCircle2,
  AlertTriangle, XCircle, Clock, Zap, Building2, ChevronDown,
} from "lucide-react";
import type { Asset, TaskWithAsset, MantenimientoKPIs } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function getToday() { return new Date().toISOString().split("T")[0]; }
function formatCOP(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n);
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

// ─── Maps de categorías / estado / prioridad ──────────────────────────────────
const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  elevator:  { label: "Ascensor",     icon: "🛗" },
  pump:      { label: "Bomba",        icon: "💧" },
  cctv:      { label: "CCTV",         icon: "📷" },
  generator: { label: "Generador",    icon: "⚡" },
  other:     { label: "Otro",         icon: "🔧" },
};
const ASSET_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: "Operacional",     color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
  maintenance: { label: "En mantenimiento", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  offline:     { label: "Fuera de línea",  color: "text-destructive", bg: "bg-destructive/10" },
};
const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Baja",     color: "text-muted-foreground", bg: "bg-secondary" },
  medium: { label: "Media",    color: "text-[#22D3EE]",       bg: "bg-[#22D3EE]/10" },
  high:   { label: "Alta",     color: "text-[#F59E0B]",       bg: "bg-[#F59E0B]/10" },
  urgent: { label: "Urgente",  color: "text-destructive",     bg: "bg-destructive/10" },
};
const TASK_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pendiente",    color: "text-[#F59E0B]",    bg: "bg-[#F59E0B]/10" },
  in_progress: { label: "En progreso",  color: "text-[#22D3EE]",    bg: "bg-[#22D3EE]/10" },
  completed:   { label: "Completada",   color: "text-[#10B981]",    bg: "bg-[#10B981]/10" },
  cancelled:   { label: "Cancelada",    color: "text-muted-foreground", bg: "bg-secondary" },
};
const TASK_STATUS_NEXT: Record<string, { next: string; label: string }> = {
  pending:     { next: "in_progress", label: "Iniciar" },
  in_progress: { next: "completed",   label: "Completar" },
  completed:   { next: "pending",     label: "Reabrir" },
  cancelled:   { next: "pending",     label: "Reabrir" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, accent, warn }: {
  label: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>; accent: string; warn?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${warn ? "border-destructive/30" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className={`text-xl font-bold tabular-nums ${warn && Number(value) > 0 ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

// ─── NuevoActivoSheet ─────────────────────────────────────────────────────────
function NuevoActivoSheet({ open, onClose, formAction, state, isPending }: {
  open: boolean; onClose: () => void;
  formAction: (p: FormData) => void;
  state: AssetFormState; isPending: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nuevo Activo</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Registra un equipo o instalación de la copropiedad.
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
            <Field label="Nombre *" htmlFor="name">
              <input id="name" name="name" type="text" required className={inputCls} placeholder="Ej. Ascensor Torre A" />
            </Field>
            <Field label="Categoría *" htmlFor="category">
              <select id="category" name="category" required className={inputCls}>
                <option value="">Seleccionar…</option>
                {Object.entries(CATEGORY_MAP).map(([v, c]) => (
                  <option key={v} value={v}>{c.icon} {c.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca" htmlFor="brand">
                <input id="brand" name="brand" type="text" className={inputCls} placeholder="Schindler" />
              </Field>
              <Field label="Modelo" htmlFor="model">
                <input id="model" name="model" type="text" className={inputCls} placeholder="MR20" />
              </Field>
            </div>
            <Field label="Número de serie" htmlFor="serialNumber">
              <input id="serialNumber" name="serialNumber" type="text" className={inputCls} placeholder="SN-2024-001" />
            </Field>
            <Field label="Ubicación" htmlFor="location">
              <input id="location" name="location" type="text" className={inputCls} placeholder="Zona de máquinas — piso 12" />
            </Field>
            <Field label="Próximo mantenimiento" htmlFor="nextMaintenance">
              <input id="nextMaintenance" name="nextMaintenance" type="date" className={inputCls} />
            </Field>
            <Field label="Notas" htmlFor="notes">
              <textarea id="notes" name="notes" rows={3} className={inputCls} placeholder="Observaciones generales…" />
            </Field>
          </div>
          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Guardar activo"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── NuevaTareaSheet ──────────────────────────────────────────────────────────
function NuevaTareaSheet({ open, onClose, assets, formAction, state, isPending }: {
  open: boolean; onClose: () => void; assets: Asset[];
  formAction: (p: FormData) => void;
  state: TaskFormState; isPending: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nueva Tarea</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Crea una orden de trabajo preventiva o correctiva.
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
            <Field label="Título *" htmlFor="title">
              <input id="title" name="title" type="text" required className={inputCls} placeholder="Ej. Revisión mensual ascensor" />
            </Field>
            <Field label="Descripción" htmlFor="description">
              <textarea id="description" name="description" rows={2} className={inputCls} placeholder="Detalles de la tarea…" />
            </Field>
            <Field label="Activo relacionado" htmlFor="assetId">
              <select id="assetId" name="assetId" className={inputCls}>
                <option value="">Sin activo vinculado</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {CATEGORY_MAP[a.category]?.icon ?? "🔧"} {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo *" htmlFor="type">
                <select id="type" name="type" required className={inputCls}>
                  <option value="">Seleccionar…</option>
                  <option value="preventive">Preventivo</option>
                  <option value="corrective">Correctivo</option>
                </select>
              </Field>
              <Field label="Prioridad" htmlFor="priority">
                <select id="priority" name="priority" defaultValue="medium" className={inputCls}>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>
            </div>
            <Field label="Asignado a" htmlFor="assignedTo">
              <input id="assignedTo" name="assignedTo" type="text" className={inputCls} placeholder="Nombre del técnico o empresa" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo estimado (COP)" htmlFor="estimatedCost">
                <input id="estimatedCost" name="estimatedCost" type="number" min="0" step="1" className={inputCls} placeholder="150000" />
              </Field>
              <Field label="Fecha programada" htmlFor="scheduledDate">
                <input id="scheduledDate" name="scheduledDate" type="date" className={inputCls} min={getToday()} />
              </Field>
            </div>
          </div>
          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : "Crear tarea"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Tab: Activos ─────────────────────────────────────────────────────────────
function AssetsTab({ slug, assets, onRefresh }: {
  slug: string; assets: Asset[];
  onRefresh?: () => void;
}) {
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const now = Math.floor(Date.now() / 1000);
  const DAYS_30 = 30 * 24 * 60 * 60;

  function handleStatusChange(assetId: string, status: string) {
    setUpdatingId(assetId);
    startTransition(async () => {
      await updateAssetStatus(slug, assetId, status);
      setUpdatingId(null);
    });
  }

  function handleDelete(assetId: string) {
    if (!confirm("¿Eliminar este activo? Solo es posible si no tiene tareas.")) return;
    setDeletingId(assetId);
    startTransition(async () => {
      await deleteAsset(slug, assetId);
      setDeletingId(null);
    });
  }

  if (assets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-foreground font-medium mb-1">No hay activos registrados</p>
        <p className="text-muted-foreground text-sm">Registra los equipos e instalaciones de la copropiedad.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/30">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activo</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Ubicación</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Próx. Mantto.</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {assets.map((a) => {
            const cat = CATEGORY_MAP[a.category] ?? { label: a.category, icon: "🔧" };
            const st  = ASSET_STATUS_MAP[a.status] ?? ASSET_STATUS_MAP.operational;
            const nextMaint = a.nextMaintenance;
            const soonAlert = nextMaint && nextMaint - now < DAYS_30 && nextMaint > now;
            const overdueAlert = nextMaint && nextMaint < now;

            return (
              <tr key={a.id} className="hover:bg-secondary/20 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.label}{a.brand ? ` · ${a.brand}` : ""}{a.model ? ` ${a.model}` : ""}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{a.location ?? "—"}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {nextMaint ? (
                    <span className={`text-xs font-medium ${overdueAlert ? "text-destructive" : soonAlert ? "text-[#F59E0B]" : "text-muted-foreground"}`}>
                      {overdueAlert && "⚠ "}{formatDate(nextMaint)}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="relative">
                    {updatingId === a.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <select
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none ${st.bg} ${st.color} pr-6`}
                        style={{ backgroundImage: "none" }}
                      >
                        <option value="operational">Operacional</option>
                        <option value="maintenance">En mantenimiento</option>
                        <option value="offline">Fuera de línea</option>
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    title="Eliminar activo"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                  >
                    {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab: Tareas ──────────────────────────────────────────────────────────────
function TasksTab({ slug, tasks }: { slug: string; tasks: TaskWithAsset[] }) {
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "all")         return tasks;
    if (filter === "pending")     return tasks.filter((t) => t.status === "pending");
    if (filter === "in_progress") return tasks.filter((t) => t.status === "in_progress");
    if (filter === "completed")   return tasks.filter((t) => t.status === "completed");
    return tasks;
  }, [tasks, filter]);

  function handleStatusUpdate(taskId: string, nextStatus: string) {
    setUpdatingId(taskId);
    startTransition(async () => {
      await updateTaskStatus(slug, taskId, nextStatus);
      setUpdatingId(null);
    });
  }

  function handleDelete(taskId: string) {
    if (!confirm("¿Eliminar esta tarea permanentemente?")) return;
    setDeletingId(taskId);
    startTransition(async () => {
      await deleteTask(slug, taskId);
      setDeletingId(null);
    });
  }

  const FILTERS = [
    { v: "all"         as const, label: "Todas",       count: tasks.length },
    { v: "pending"     as const, label: "Pendientes",  count: tasks.filter(t=>t.status==="pending").length },
    { v: "in_progress" as const, label: "En progreso", count: tasks.filter(t=>t.status==="in_progress").length },
    { v: "completed"   as const, label: "Completadas", count: tasks.filter(t=>t.status==="completed").length },
  ];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg w-fit flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${filter === f.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {f.label} <span className="ml-1 opacity-60 tabular-nums">({f.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">{tasks.length === 0 ? "No hay tareas" : "Sin tareas en esta categoría"}</p>
          <p className="text-muted-foreground text-sm">{tasks.length === 0 ? "Crea órdenes de trabajo preventivas o correctivas." : "Prueba con otro filtro."}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarea</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Activo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => {
                const st  = TASK_STATUS_MAP[t.status]  ?? TASK_STATUS_MAP.pending;
                const pri = PRIORITY_MAP[t.priority]   ?? PRIORITY_MAP.medium;
                const nxt = TASK_STATUS_NEXT[t.status];
                return (
                  <tr key={t.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.type === "preventive" ? "Preventivo" : "Correctivo"}
                        {t.assignedTo ? ` · ${t.assignedTo}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {t.assetName ? (
                        <span className="text-xs text-muted-foreground">{t.assetName}</span>
                      ) : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.bg} ${pri.color}`}>
                        {pri.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs ${t.isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {t.isOverdue && "⚠ "}{formatDate(t.scheduledDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${st.bg} ${st.color}`}>
                        {t.status === "completed"   && <CheckCircle2 className="w-3 h-3" />}
                        {t.status === "in_progress" && <Clock className="w-3 h-3" />}
                        {t.status === "cancelled"   && <XCircle className="w-3 h-3" />}
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {nxt && t.status !== "completed" && t.status !== "cancelled" && (
                          <button
                            onClick={() => handleStatusUpdate(t.id, nxt.next)}
                            disabled={updatingId === t.id}
                            title={nxt.label}
                            className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {updatingId === t.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : nxt.label}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MantenimientoClient({
  slug, assets, tasks, kpis,
}: {
  slug: string;
  assets: Asset[];
  tasks: TaskWithAsset[];
  kpis: MantenimientoKPIs;
}) {
  const [tab,             setTab]             = useState<"assets" | "tasks">("assets");
  const [openNuevoActivo, setOpenNuevoActivo] = useState(false);
  const [openNuevaTarea,  setOpenNuevaTarea]  = useState(false);

  // ─── Asset form state
  const [assetState, assetAction, assetPending] =
    useActionState<AssetFormState, FormData>(createAsset.bind(null, slug), null);
  const assetHandledRef = useRef<AssetFormState>(null);
  useEffect(() => {
    if (assetState?.success && assetState !== assetHandledRef.current) {
      assetHandledRef.current = assetState;
      setOpenNuevoActivo(false);
    }
  }, [assetState]);

  // ─── Task form state
  const [taskState, taskAction, taskPending] =
    useActionState<TaskFormState, FormData>(createTask.bind(null, slug), null);
  const taskHandledRef = useRef<TaskFormState>(null);
  useEffect(() => {
    if (taskState?.success && taskState !== taskHandledRef.current) {
      taskHandledRef.current = taskState;
      setOpenNuevaTarea(false);
    }
  }, [taskState]);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mantenimiento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {assets.length} activo{assets.length !== 1 ? "s" : ""} · {tasks.length} tarea{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => tab === "assets" ? setOpenNuevoActivo(true) : setOpenNuevaTarea(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {tab === "assets" ? "Nuevo activo" : "Nueva tarea"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Operacionales"     value={kpis.operationalCount}  icon={CheckCircle2}  accent="bg-[#10B981]/10 text-[#10B981]" />
        <KPICard label="En mantenimiento"  value={kpis.maintenanceCount}  icon={Wrench}         accent="bg-[#F59E0B]/10 text-[#F59E0B]" />
        <KPICard label="Fuera de línea"    value={kpis.offlineCount}      icon={XCircle}        accent="bg-destructive/10 text-destructive" />
        <KPICard label="Tareas abiertas"   value={kpis.openTasksCount}    icon={ClipboardList}  accent="bg-[#22D3EE]/10 text-[#22D3EE]" />
        <KPICard label="Tareas vencidas"   value={kpis.overdueTasksCount} icon={AlertTriangle}  accent="bg-destructive/10 text-destructive" warn />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("assets")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "assets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Wrench className="w-4 h-4" /> Activos
          <span className="text-xs opacity-60 tabular-nums">({assets.length})</span>
        </button>
        <button
          onClick={() => setTab("tasks")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "tasks" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ClipboardList className="w-4 h-4" /> Tareas
          <span className="text-xs opacity-60 tabular-nums">({tasks.length})</span>
        </button>
      </div>

      {/* Contenido del tab activo */}
      {tab === "assets"
        ? <AssetsTab slug={slug} assets={assets} />
        : <TasksTab  slug={slug} tasks={tasks}  />
      }

      {/* Sheets */}
      <NuevoActivoSheet
        open={openNuevoActivo}
        onClose={() => setOpenNuevoActivo(false)}
        formAction={assetAction}
        state={assetState}
        isPending={assetPending}
      />
      <NuevaTareaSheet
        open={openNuevaTarea}
        onClose={() => setOpenNuevaTarea(false)}
        assets={assets}
        formAction={taskAction}
        state={taskState}
        isPending={taskPending}
      />
    </>
  );
}
