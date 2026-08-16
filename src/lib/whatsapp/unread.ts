import "server-only";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { and, eq, gt, sql } from "drizzle-orm";

const LAST_SEEN_KEY = "whatsapp_last_seen";

export async function getWhatsappLastSeen(slug: string): Promise<number> {
  const db = await getTenantDb(slug);
  const row = await db
    .select({ value: tenantSchema.buildingConfig.value })
    .from(tenantSchema.buildingConfig)
    .where(eq(tenantSchema.buildingConfig.key, LAST_SEEN_KEY))
    .get();
  return row ? parseInt(row.value, 10) || 0 : 0;
}

export async function getUnreadWhatsappCount(slug: string): Promise<number> {
  const lastSeen = await getWhatsappLastSeen(slug);
  const db = await getTenantDb(slug);
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenantSchema.whatsappMessages)
    .where(and(
      eq(tenantSchema.whatsappMessages.direction, "inbound"),
      gt(tenantSchema.whatsappMessages.createdAt, lastSeen)
    ))
    .get();
  return result?.count ?? 0;
}

export async function markWhatsappSeen(slug: string): Promise<void> {
  const db = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(tenantSchema.buildingConfig)
    .values({ key: LAST_SEEN_KEY, value: String(now), updatedAt: now })
    .onConflictDoUpdate({
      target: tenantSchema.buildingConfig.key,
      set: { value: String(now), updatedAt: now },
    });
}
