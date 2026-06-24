import { requireResidentContext } from "@/lib/resident-auth";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, desc, inArray } from "drizzle-orm";
import PqrsResidentClient from "./PqrsResidentClient";

export default async function ResidentPqrsPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireResidentContext(slug);
  const db  = await getTenantDb(slug);

  // PQRS de las unidades del residente
  const [items, allForNumbering] = await Promise.all([
    ctx.unitIds.length
      ? db.select().from(tenantSchema.pqrs)
          .where(inArray(tenantSchema.pqrs.unitId, ctx.unitIds))
          .orderBy(desc(tenantSchema.pqrs.createdAt))
      : Promise.resolve([]),
    // Consecutivo global del edificio (igual al que ve la administración)
    db.select({ id: tenantSchema.pqrs.id, createdAt: tenantSchema.pqrs.createdAt })
      .from(tenantSchema.pqrs),
  ]);

  const ticketMap = new Map(
    [...allForNumbering]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((p, i) => [p.id, i + 1])
  );

  return (
    <div className="p-6 space-y-5">
      <PqrsResidentClient
        slug={slug}
        unitIds={ctx.unitIds}
        items={items.map((p) => {
          let attachments: string[] = [];
          try { attachments = JSON.parse(p.attachments ?? "[]"); } catch {}
          return {
            id:           p.id,
            ticketNumber: ticketMap.get(p.id) ?? 0,
            type:         p.type,
            subject:      p.subject,
            description:  p.description,
            status:       p.status,
            response:     p.response ?? null,
            attachments,
            createdAt:    p.createdAt,
            updatedAt:    p.updatedAt,
          };
        })}
      />
    </div>
  );
}
