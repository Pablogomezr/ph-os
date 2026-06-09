import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc, isNotNull } from "drizzle-orm";
import { Bell, Megaphone, FileText, ClipboardList } from "lucide-react";

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const TYPE_CONFIG = {
  announcement: { label: "Aviso",    icon: Megaphone,    color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
  circular:     { label: "Circular", icon: FileText,     color: "text-[#6366F1]", bg: "bg-[#6366F1]/10" },
  acta:         { label: "Acta",     icon: ClipboardList, color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
  invoice:      { label: "Factura",  icon: Bell,         color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/10" },
} as const;

export default async function ResidentMensajeriaPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireResidentContext(slug);
  const db = await getTenantDb(slug);

  // Solo comunicados publicados (publishedAt IS NOT NULL)
  const allComms = await db
    .select()
    .from(tenantSchema.communications)
    .where(isNotNull(tenantSchema.communications.publishedAt))
    .orderBy(desc(tenantSchema.communications.publishedAt));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunicados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Avisos, circulares y actas publicadas por la administración
        </p>
      </div>

      {allComms.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay comunicados publicados aún.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allComms.map((c) => {
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.publishedAt ? formatDate(c.publishedAt) : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-5 pb-5 pt-2 border-t border-border">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
