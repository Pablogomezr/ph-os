"use client";

import {
  useActionState, useState, useTransition, useEffect, useRef, useMemo,
} from "react";
import {
  createComunicado, publishComunicado, unpublishComunicado, deleteComunicado,
} from "./actions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, Loader2, Trash2, Send, FileText, Megaphone,
  ScrollText, ReceiptText, Eye, EyeOff, BookOpen, Paperclip, Download,
} from "lucide-react";
import type { ComunicadoView, ComunicadosKPIs, ComunicadoFormState } from "./types";
import { attachmentFileName } from "@/lib/attachment-utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function formatDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatTicket(n: number) {
  return `COM-${String(n).padStart(4, "0")}`;
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

// ─── Maps ─────────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  announcement: { label: "Anuncio",   color: "text-[#22D3EE]",    bg: "bg-[#22D3EE]/10",   icon: Megaphone },
  circular:     { label: "Circular",  color: "text-[#6366F1]",    bg: "bg-[#6366F1]/10",   icon: ScrollText },
  acta:         { label: "Acta",      color: "text-[#10B981]",    bg: "bg-[#10B981]/10",   icon: BookOpen },
  invoice:      { label: "Factura",   color: "text-[#F59E0B]",    bg: "bg-[#F59E0B]/10",   icon: ReceiptText },
};
const TARGET_LABELS: Record<string, string> = {
  '["all"]':         "Todos los residentes",
  '["owner"]':       "Solo propietarios",
  '["tenant"]':      "Solo arrendatarios",
  '["owner","tenant"]': "Propietarios y arrendatarios",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, accent }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>; accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent}`}><Icon className="w-3.5 h-3.5" /></div>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

// ─── NuevoComunicadoSheet ─────────────────────────────────────────────────────
function NuevoComunicadoSheet({ open, onClose, formAction, state, isPending }: {
  open: boolean; onClose: () => void;
  formAction: (p: FormData) => void;
  state: ComunicadoFormState; isPending: boolean;
}) {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!open) setCharCount(0);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nuevo Comunicado</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Se guardará como borrador. Publícalo cuando esté listo.
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo *" htmlFor="type">
                <select id="type" name="type" required className={inputCls}>
                  <option value="">Seleccionar…</option>
                  <option value="announcement">📢 Anuncio</option>
                  <option value="circular">📜 Circular</option>
                  <option value="acta">📖 Acta</option>
                  <option value="invoice">🧾 Factura</option>
                </select>
              </Field>
              <Field label="Dirigido a" htmlFor="targetRoles">
                <select id="targetRoles" name="targetRoles" defaultValue='["all"]' className={inputCls}>
                  <option value='["all"]'>Todos</option>
                  <option value='["owner"]'>Propietarios</option>
                  <option value='["tenant"]'>Arrendatarios</option>
                  <option value='["owner","tenant"]'>Prop. y Arrend.</option>
                </select>
              </Field>
            </div>

            <Field label="Título *" htmlFor="title">
              <input
                id="title" name="title" type="text" required className={inputCls}
                placeholder="Ej. Reunión de Asamblea General — Junio 2026"
              />
            </Field>

            <Field
              label="Cuerpo *"
              htmlFor="body"
              hint={`${charCount} caracteres`}
            >
              <textarea
                id="body" name="body" rows={8} required className={inputCls}
                placeholder="Estimados residentes,&#10;&#10;Por medio del presente comunicado…"
                onChange={(e) => setCharCount(e.target.value.length)}
              />
            </Field>

            <Field label="Documentos adjuntos" htmlFor="attachments">
              <input
                id="attachments" name="attachments" type="file" multiple
                className="w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground file:text-xs file:font-medium hover:file:bg-secondary/80"
              />
            </Field>
          </div>

          <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
                : <><FileText className="w-4 h-4" />Guardar borrador</>}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── DetailSheet (leer comunicado completo) ───────────────────────────────────
function DetailSheet({ item, open, onClose, slug }: {
  item: ComunicadoView | null; open: boolean; onClose: () => void; slug: string;
}) {
  const [publishing, startPublishTransition] = useTransition();

  if (!item) return null;

  const tp = TYPE_MAP[item.type] ?? TYPE_MAP.announcement;
  const TypeIcon = tp.icon;
  const target = TARGET_LABELS[item.targetRoles.join(",")] ??
    TARGET_LABELS[JSON.stringify(item.targetRoles)] ??
    "Todos los residentes";

  function handlePublish() {
    startPublishTransition(async () => {
      await publishComunicado(slug, item!.id);
      onClose();
    });
  }
  function handleUnpublish() {
    startPublishTransition(async () => {
      await unpublishComunicado(slug, item!.id);
      onClose();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground">
                {formatTicket(item.ticketNumber)}
              </span>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${tp.bg} ${tp.color}`}>
                <TypeIcon className="w-3 h-3" />{tp.label}
              </span>
              {item.isPublished ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981]">
                  <Eye className="w-3 h-3" /> Publicado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  <EyeOff className="w-3 h-3" /> Borrador
                </span>
              )}
            </div>
            <SheetTitle className="text-foreground leading-snug">{item.title}</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {target} · {formatDate(item.createdAt)}
              {item.publishedAt && ` · Publicado ${formatDateTime(item.publishedAt)}`}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-secondary/30 rounded-xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {item.body}
          </div>

          {item.attachmentUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Documentos adjuntos ({item.attachmentUrls.length})
              </p>
              <div className="space-y-1.5">
                {item.attachmentUrls.map((url) => (
                  <a
                    key={url} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 hover:bg-primary/10 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1">{attachmentFileName(url)}</span>
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-border bg-card shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 border border-border text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
            Cerrar
          </button>
          {item.isPublished ? (
            <button
              type="button" onClick={handleUnpublish} disabled={publishing}
              className="flex-1 flex items-center justify-center gap-2 border border-[#F59E0B]/40 text-[#F59E0B] py-2.5 rounded-lg text-sm font-medium hover:bg-[#F59E0B]/10 disabled:opacity-50 transition-colors"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
              Volver a borrador
            </button>
          ) : (
            <button
              type="button" onClick={handlePublish} disabled={publishing}
              className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#10B981]/90 disabled:opacity-50 transition-colors"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publicar
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MensajeriaClient({
  slug, items, kpis,
}: {
  slug: string;
  items: ComunicadoView[];
  kpis: ComunicadosKPIs;
}) {
  const [openNuevo,    setOpenNuevo]    = useState(false);
  const [detailItem,   setDetailItem]   = useState<ComunicadoView | null>(null);
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [ticketFilter, setTicketFilter] = useState("");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const [state, formAction, isPending] =
    useActionState<ComunicadoFormState, FormData>(createComunicado.bind(null, slug), null);
  const handledRef = useRef<ComunicadoFormState>(null);
  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      setOpenNuevo(false);
    }
  }, [state]);

  const filtered = useMemo(() => {
    const ticketQuery = ticketFilter.trim().replace(/^COM-?/i, "").replace(/^0+/, "");
    return items.filter((c) => {
      const matchType   = typeFilter   === "all" || c.type === typeFilter;
      const matchStatus = statusFilter === "all"
        || (statusFilter === "published" && c.isPublished)
        || (statusFilter === "draft"     && !c.isPublished);
      const matchTicket = ticketQuery === "" || String(c.ticketNumber).includes(ticketQuery);
      return matchType && matchStatus && matchTicket;
    });
  }, [items, typeFilter, statusFilter, ticketFilter]);

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este comunicado permanentemente?")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deleteComunicado(slug, id);
      setDeletingId(null);
    });
  }

  const STATUS_FILTERS = [
    { v: "all"       as const, label: "Todos",       count: items.length },
    { v: "published" as const, label: "Publicados",  count: kpis.published },
    { v: "draft"     as const, label: "Borradores",  count: kpis.drafts },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mensajería</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} comunicado{items.length !== 1 ? "s" : ""} · {kpis.published} publicado{kpis.published !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpenNuevo(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo comunicado
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Total"        value={kpis.total}         icon={FileText}   accent="bg-primary/10 text-primary" />
        <KPICard label="Publicados"   value={kpis.published}     icon={Eye}        accent="bg-[#10B981]/10 text-[#10B981]" />
        <KPICard label="Borradores"   value={kpis.drafts}        icon={EyeOff}     accent="bg-secondary text-muted-foreground" />
        <KPICard label="Anuncios"     value={kpis.announcements} icon={Megaphone}  accent="bg-[#22D3EE]/10 text-[#22D3EE]" />
        <KPICard label="Circulares"   value={kpis.circulars}     icon={ScrollText} accent="bg-[#6366F1]/10 text-[#6366F1]" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-secondary/40 p-1 rounded-lg">
          {STATUS_FILTERS.map((f) => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === f.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label} <span className="ml-1 opacity-60 tabular-nums">({f.count})</span>
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="all">Todos los tipos</option>
          <option value="announcement">📢 Anuncio</option>
          <option value="circular">📜 Circular</option>
          <option value="acta">📖 Acta</option>
          <option value="invoice">🧾 Factura</option>
        </select>
        <input
          type="text"
          value={ticketFilter}
          onChange={(e) => setTicketFilter(e.target.value)}
          placeholder="Buscar por consecutivo… (ej. COM-0012)"
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-56"
        />
      </div>

      {/* Lista de comunicados */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-medium mb-1">
            {items.length === 0 ? "No hay comunicados" : "Sin comunicados en esta categoría"}
          </p>
          <p className="text-muted-foreground text-sm mb-5">
            {items.length === 0 ? "Crea anuncios, circulares y actas para los residentes." : "Prueba ajustando los filtros."}
          </p>
          {items.length === 0 && (
            <button onClick={() => setOpenNuevo(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Primer comunicado
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const tp = TYPE_MAP[c.type] ?? TYPE_MAP.announcement;
            const TypeIcon = tp.icon;
            const target = TARGET_LABELS[c.targetRoles.join(",")] ??
              TARGET_LABELS[JSON.stringify(c.targetRoles)] ?? "Todos";
            return (
              <div
                key={c.id}
                onClick={() => setDetailItem(c)}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:bg-secondary/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  {/* Icono tipo */}
                  <div className={`p-2 rounded-lg shrink-0 ${tp.bg}`}>
                    <TypeIcon className={`w-4 h-4 ${tp.color}`} />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono font-semibold text-muted-foreground">{formatTicket(c.ticketNumber)}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={`text-xs font-semibold ${tp.color}`}>{tp.label}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">{target}</span>
                        </div>
                        <p className="font-semibold text-foreground leading-tight flex items-center gap-1.5">
                          {c.title}
                          {c.attachmentUrls.length > 0 && <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                      {/* Estado + fecha */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {c.isPublished ? (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981]">
                            <Eye className="w-3 h-3" /> Publicado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            <EyeOff className="w-3 h-3" /> Borrador
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(c.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones — aparecen en hover */}
                <div
                  className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={() => setDetailItem(c)}
                    className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    {c.isPublished ? "Leer" : "Leer / Publicar"}
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                    {deletingId === c.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sheets */}
      <NuevoComunicadoSheet
        open={openNuevo}
        onClose={() => setOpenNuevo(false)}
        formAction={formAction}
        state={state}
        isPending={isPending}
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
