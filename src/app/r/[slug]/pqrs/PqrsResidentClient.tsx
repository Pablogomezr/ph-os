"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Plus, MessageSquare, X, CheckCircle2, Paperclip, Download } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { createResidentPqrs, type PqrsResidentState } from "./actions";
import { attachmentFileName } from "@/lib/attachment-utils";

const TYPE_OPTIONS = [
  { value: "petition",    label: "Petición",    color: "text-[#6366F1]", bg: "bg-[#6366F1]/10"  },
  { value: "complaint",   label: "Queja",       color: "text-[#EF4444]", bg: "bg-[#EF4444]/10"  },
  { value: "claim",       label: "Reclamo",     color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10"  },
  { value: "suggestion",  label: "Sugerencia",  color: "text-[#10B981]", bg: "bg-[#10B981]/10"  },
];

const STATUS_CONFIG = {
  open:      { label: "Abierto",     color: "bg-[#6366F1]/10 text-[#6366F1]" },
  in_review: { label: "En revisión", color: "bg-[#F59E0B]/10 text-[#F59E0B]" },
  resolved:  { label: "Resuelto",    color: "bg-[#10B981]/10 text-[#10B981]" },
  closed:    { label: "Cerrado",     color: "bg-muted text-muted-foreground"  },
};

interface PqrsItem {
  id: string; ticketNumber: number; type: string; subject: string; description: string;
  status: string; response: string | null; attachments: string[];
  createdAt: number; updatedAt: number;
}

interface Props {
  slug: string; unitIds: string[]; items: PqrsItem[];
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatTicket(n: number) {
  return `PQR-${String(n).padStart(4, "0")}`;
}

export default function PqrsResidentClient({ slug, unitIds, items }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PqrsItem | null>(null);
  const [ticketFilter, setTicketFilter] = useState("");

  const filteredItems = (() => {
    const q = ticketFilter.trim().replace(/^PQR-?/i, "").replace(/^0+/, "");
    if (q === "") return items;
    return items.filter((item) => String(item.ticketNumber).includes(q));
  })();

  const createBound = createResidentPqrs.bind(null, slug);
  const [state, formAction, isPending] = useActionState<PqrsResidentState, FormData>(
    createBound, null
  );

  const handledRef = useRef<PqrsResidentState>(null);
  useEffect(() => {
    if (state?.success && state !== handledRef.current) {
      handledRef.current = state;
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      {/* Header + botón */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis PQRS</h1>
          <p className="text-muted-foreground text-sm mt-1">Peticiones, quejas, reclamos y sugerencias</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />Nueva solicitud
        </button>
      </div>

      {/* Filtro por consecutivo */}
      {items.length > 0 && (
        <input
          type="text"
          value={ticketFilter}
          onChange={(e) => setTicketFilter(e.target.value)}
          placeholder="Buscar por consecutivo… (ej. PQR-0012)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No has radicado ninguna solicitud aún.</p>
          <button
            onClick={() => setOpen(true)}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Radica tu primera solicitud →
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Ningún resultado para ese consecutivo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const typeInfo = TYPE_OPTIONS.find((t) => t.value === item.type);
            const statusInfo = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeInfo?.bg ?? ""} ${typeInfo?.color ?? ""}`}>
                    {typeInfo?.label ?? item.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono font-semibold text-muted-foreground">{formatTicket(item.ticketNumber)}</p>
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                      {item.subject}
                      {item.attachments.length > 0 && <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <p className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
                {item.response && (
                  <div className="mt-3 pl-3 border-l-2 border-[#10B981]/40">
                    <p className="text-[11px] text-muted-foreground font-semibold mb-0.5">Respuesta de administración:</p>
                    <p className="text-xs text-foreground line-clamp-2">{item.response}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Sheet nueva PQRS */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle>Nueva solicitud</SheetTitle>
            <SheetDescription>Radica una petición, queja, reclamo o sugerencia</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Tipo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tipo de solicitud *</label>
                <select name="type" required
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Selecciona...</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Unidad */}
              {unitIds.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Unidad</label>
                  <select name="unitId"
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {unitIds.map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
              )}
              {unitIds.length <= 1 && unitIds[0] && (
                <input type="hidden" name="unitId" value={unitIds[0]} />
              )}

              {/* Asunto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Asunto *</label>
                <input type="text" name="subject" required placeholder="Ej: Fuga de agua en baño"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Descripción *</label>
                <textarea name="description" required rows={5}
                  placeholder="Describe el problema o solicitud con el mayor detalle posible..."
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>

              {/* Documentos adjuntos */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Documentos adjuntos (opcional)</label>
                <input
                  type="file" name="attachments" multiple
                  className="w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-muted file:text-foreground file:text-xs file:font-medium hover:file:bg-muted/80"
                />
              </div>

              {state?.error && (
                <p className="text-xs text-[#EF4444] bg-[#EF4444]/10 rounded-lg px-3 py-2">{state.error}</p>
              )}
              {state?.success && (
                <p className="text-xs text-[#10B981] bg-[#10B981]/10 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Solicitud radicada exitosamente.
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-border px-6 py-4 flex gap-3">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {isPending ? "Enviando…" : "Radicar solicitud"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Sheet detalle PQRS */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="flex flex-col p-0">
          {selected && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                <p className="text-xs font-mono font-bold text-muted-foreground">{formatTicket(selected.ticketNumber)}</p>
                <SheetTitle className="text-base">{selected.subject}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const t = TYPE_OPTIONS.find((x) => x.value === selected.type);
                    const s = STATUS_CONFIG[selected.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
                    return (
                      <>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t?.bg} ${t?.color}`}>{t?.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                      </>
                    );
                  })()}
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(selected.createdAt)}</span>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Descripción</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>

                {selected.attachments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Documentos adjuntos ({selected.attachments.length})
                    </p>
                    <div className="space-y-1.5">
                      {selected.attachments.map((url) => (
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

                {selected.response ? (
                  <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#10B981] mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />Respuesta de administración
                    </p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.response}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{formatDate(selected.updatedAt)}</p>
                  </div>
                ) : (
                  <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
                    <p className="text-xs text-[#F59E0B]">Pendiente de respuesta por la administración.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
