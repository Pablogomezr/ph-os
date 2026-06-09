import { requireModule } from "../_components/ModuleGuard";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { desc } from "drizzle-orm";
import MantenimientoClient from "./MantenimientoClient";
import type { TaskWithAsset, MantenimientoKPIs } from "./types";

export default async function MantenimientoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireModule(slug, "mantenimiento");

  const db  = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);

  const [assets, rawTasks] = await Promise.all([
    db.select().from(tenantSchema.assets).orderBy(desc(tenantSchema.assets.createdAt)),
    db.select().from(tenantSchema.maintenanceTasks).orderBy(desc(tenantSchema.maintenanceTasks.createdAt)),
  ]);

  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a.name]));

  // ─── Construir TaskWithAsset[] ────────────────────────────────────────────────
  const tasks: TaskWithAsset[] = rawTasks.map((t) => {
    const done    = t.status === "completed" || t.status === "cancelled";
    const isOverdue = !done && !!t.scheduledDate && t.scheduledDate < now;
    return {
      id:            t.id,
      assetId:       t.assetId ?? null,
      assetName:     t.assetId ? (assetMap[t.assetId] ?? null) : null,
      title:         t.title,
      description:   t.description ?? null,
      type:          t.type,
      priority:      t.priority,
      status:        t.status,
      assignedTo:    t.assignedTo ?? null,
      estimatedCost: t.estimatedCost ?? null,
      actualCost:    t.actualCost ?? null,
      scheduledDate: t.scheduledDate ?? null,
      completedDate: t.completedDate ?? null,
      isOverdue,
      createdAt:     t.createdAt,
    };
  });

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis: MantenimientoKPIs = {
    operationalCount:  assets.filter((a) => a.status === "operational").length,
    maintenanceCount:  assets.filter((a) => a.status === "maintenance").length,
    offlineCount:      assets.filter((a) => a.status === "offline").length,
    openTasksCount:    tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
    overdueTasksCount: tasks.filter((t) => t.isOverdue).length,
  };

  return (
    <div className="p-6 space-y-5">
      <MantenimientoClient
        slug={slug}
        assets={assets}
        tasks={tasks}
        kpis={kpis}
      />
    </div>
  );
}
