import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import UnidadesClient from "./UnidadesClient";

export default async function UnidadesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let units: typeof tenantSchema.units.$inferSelect[] = [];
  try {
    const db = await getTenantDb(slug);
    units = await db.select().from(tenantSchema.units);
  } catch {}

  return (
    <div className="p-6 space-y-5">
      <UnidadesClient slug={slug} units={units} />
    </div>
  );
}
