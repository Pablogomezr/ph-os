import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc } from "drizzle-orm";
import PqrsClient from "./PqrsClient";
import type { PqrsWithUnit, PqrsKPIs } from "./types";

export default async function PqrsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "pqrs");

  const db = await getTenantDb(slug);

  const [rawItems, units] = await Promise.all([
    db.select().from(tenantSchema.pqrs).orderBy(desc(tenantSchema.pqrs.createdAt)),
    db.select().from(tenantSchema.units),
  ]);

  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.number]));

  // ─── Consecutivo: orden cronológico de creación (no se ve afectado por el
  // orden de visualización ni por eliminaciones futuras) ────────────────────
  const ticketMap = new Map(
    [...rawItems]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((p, i) => [p.id, i + 1])
  );

  // ─── Construir PqrsWithUnit[] ─────────────────────────────────────────────
  const items: PqrsWithUnit[] = rawItems.map((p) => {
    let attachments: string[] = [];
    try { attachments = JSON.parse(p.attachments ?? "[]"); } catch {}
    return {
      id:          p.id,
      ticketNumber: ticketMap.get(p.id) ?? 0,
      unitId:      p.unitId,
      unitNumber:  unitMap[p.unitId] ?? "?",
      userId:      p.userId,
      type:        p.type,
      subject:     p.subject,
      description: p.description,
      status:      p.status,
      priority:    p.priority,
      response:    p.response ?? null,
      attachments,
      resolvedAt:  p.resolvedAt ?? null,
      createdAt:   p.createdAt,
      updatedAt:   p.updatedAt,
    };
  });

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const kpis: PqrsKPIs = {
    total:    items.length,
    open:     items.filter((p) => p.status === "open").length,
    inReview: items.filter((p) => p.status === "in_review").length,
    resolved: items.filter((p) => p.status === "resolved").length,
    closed:   items.filter((p) => p.status === "closed").length,
  };

  return (
    <div className="p-6 space-y-5">
      <PqrsClient
        slug={slug}
        items={items}
        units={units}
        kpis={kpis}
      />
    </div>
  );
}
