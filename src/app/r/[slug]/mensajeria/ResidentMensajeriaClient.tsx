"use client";

import { useState } from "react";
import { Bell, Megaphone, FileText, ClipboardList, Paperclip, Download } from "lucide-react";
import { attachmentFileName } from "@/lib/attachment-utils";

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function formatTicket(n: number) {
  return `COM-${String(n).padStart(4, "0")}`;
}

const TYPE_CONFIG = {
  announcement: { label: "Aviso",    icon: Megaphone,    color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  circular:     { label: "Circular", icon: FileText,     color: "text-[#6366F1]", bg: "bg-[#6366F1]/10" },
  acta:         { label: "Acta",     icon: ClipboardList, color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
  invoice:      { label: "Factura",  icon: Bell,         color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
} as const;

interface ComunicadoItem {
  id: string;
  ticketNumber: number;
  title: string;
  body: string;
  type: string;
  publishedAt: number | null;
  attachmentUrls: string[];
}

export default function ResidentMensajeriaClient({ items }: { items: ComunicadoItem[] }) {
  const [ticketFilter, setTicketFilter] = useState("");

  const q = ticketFilter.trim().replace(/^COM-?/i, "").replace(/^0+/, "");
  const filtered = q === "" ? items : items.filter((c) => String(c.ticketNumber).includes(q));

  return (
    <>
      {items.length > 0 && (
        <input
          type="text"
          value={ticketFilter}
          onChange={(e) => setTicketFilter(e.target.value)}
          placeholder="Buscar por consecutivo… (ej. COM-0012)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay comunicados publicados aún.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Ningún resultado para ese consecutivo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const typeKey = c.type as keyof typeof TYPE_CONFIG;
            const cfg = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.announcement;
            const Icon = cfg.icon;
            return (
              <details key={c.id} className="group bg-card border border-border rounded-xl overflow-hidden">
                <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                  <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">{formatTicket(c.ticketNumber)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                        {c.title}
                        {c.attachmentUrls.length > 0 && <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.publishedAt ? formatDate(c.publishedAt) : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-5 pt-2 border-t border-border space-y-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  {c.attachmentUrls.length > 0 && (
                    <div className="space-y-1.5">
                      {c.attachmentUrls.map((url) => (
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
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
