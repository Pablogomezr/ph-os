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
  const items = ctx.unitIds.length
    ? await db.select().from(tenantSchema.pqrs)
        .where(inArray(tenantSchema.pqrs.unitId, ctx.unitIds))
        .orderBy(desc(tenantSchema.pqrs.createdAt))
    : [];

  return (
    <div className="p-6 space-y-5">
      <PqrsResidentClient
        slug={slug}
        unitIds={ctx.unitIds}
        items={items.map((p) => ({
          id:          p.id,
          type:        p.type,
          subject:     p.subject,
          description: p.description,
          status:      p.status,
          response:    p.response ?? null,
          createdAt:   p.createdAt,
          updatedAt:   p.updatedAt,
        }))}
      />
    </div>
  );
}
