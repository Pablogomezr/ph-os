import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import ResidentesClient from "./ResidentesClient";

export default async function ResidentesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let residents: typeof tenantSchema.users.$inferSelect[] = [];
  let units: typeof tenantSchema.units.$inferSelect[] = [];
  try {
    const db = await getTenantDb(slug);
    [residents, units] = await Promise.all([
      db.select().from(tenantSchema.users),
      db.select().from(tenantSchema.units),
    ]);
  } catch {}

  return (
    <div className="p-6 space-y-5">
      <ResidentesClient slug={slug} residents={residents} units={units} />
    </div>
  );
}
