import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc, isNotNull } from "drizzle-orm";
import ResidentMensajeriaClient from "./ResidentMensajeriaClient";

export default async function ResidentMensajeriaPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db = await getTenantDb(slug);

  // Solo comunicados publicados (publishedAt IS NOT NULL) + consecutivo global
  const [allComms, allForNumbering] = await Promise.all([
    db.select().from(tenantSchema.communications)
      .where(isNotNull(tenantSchema.communications.publishedAt))
      .orderBy(desc(tenantSchema.communications.publishedAt)),
    db.select({ id: tenantSchema.communications.id, createdAt: tenantSchema.communications.createdAt })
      .from(tenantSchema.communications),
  ]);

  const ticketMap = new Map(
    [...allForNumbering]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c, i) => [c.id, i + 1])
  );

  // Un comunicado llega a este residente si: lo incluye su envío puntual
  // (targetUserIds), o si no hay envío puntual y su rol calza con targetRoles.
  const roleKey = ctx.user.role === "tenant" ? "tenant" : "owner";
  const visibleComms = allComms.filter((c) => {
    let targetUserIds: string[] = [];
    try { targetUserIds = JSON.parse(c.targetUserIds ?? "[]"); } catch {}
    if (targetUserIds.length > 0) return targetUserIds.includes(ctx.user.id);

    let targetRoles: string[] = ["all"];
    try { targetRoles = JSON.parse(c.targetRoles); } catch {}
    return targetRoles.includes("all") || targetRoles.includes(roleKey);
  });

  const items = visibleComms.map((c) => {
    let attachmentUrls: string[] = [];
    try { attachmentUrls = JSON.parse(c.attachmentUrls ?? "[]"); } catch {}
    return {
      id:            c.id,
      ticketNumber:  ticketMap.get(c.id) ?? 0,
      title:         c.title,
      body:          c.body,
      type:          c.type,
      publishedAt:   c.publishedAt ?? null,
      attachmentUrls,
    };
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunicados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Avisos, circulares y actas publicadas por la administración
        </p>
      </div>
      <ResidentMensajeriaClient items={items} />
    </div>
  );
}
