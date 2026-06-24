import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc } from "drizzle-orm";
import MensajeriaClient from "./MensajeriaClient";
import type { ComunicadoView, ComunicadosKPIs } from "./types";

export default async function MensajeriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "mensajeria");

  const db = await getTenantDb(slug);

  const rawItems = await db
    .select()
    .from(tenantSchema.communications)
    .orderBy(desc(tenantSchema.communications.createdAt));

  // ─── Consecutivo: orden cronológico de creación ───────────────────────────
  const ticketMap = new Map(
    [...rawItems]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c, i) => [c.id, i + 1])
  );

  // ─── Construir ComunicadoView[] ──────────────────────────────────────────
  const items: ComunicadoView[] = rawItems.map((c) => {
    let targetRoles: string[] = ["all"];
    try { targetRoles = JSON.parse(c.targetRoles); } catch {}
    let attachmentUrls: string[] = [];
    try { attachmentUrls = JSON.parse(c.attachmentUrls ?? "[]"); } catch {}
    return {
      id:           c.id,
      ticketNumber: ticketMap.get(c.id) ?? 0,
      title:        c.title,
      body:         c.body,
      type:         c.type,
      targetRoles,
      attachmentUrls,
      publishedAt:  c.publishedAt ?? null,
      isPublished:  !!c.publishedAt,
      createdBy:    c.createdBy,
      createdAt:    c.createdAt,
    };
  });

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const kpis: ComunicadosKPIs = {
    total:         items.length,
    published:     items.filter((c) =>  c.isPublished).length,
    drafts:        items.filter((c) => !c.isPublished).length,
    announcements: items.filter((c) => c.type === "announcement").length,
    circulars:     items.filter((c) => c.type === "circular").length,
  };

  return (
    <div className="p-6 space-y-5">
      <MensajeriaClient
        slug={slug}
        items={items}
        kpis={kpis}
      />
    </div>
  );
}
