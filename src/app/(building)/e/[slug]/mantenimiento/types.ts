import type { tenantSchema } from "@/lib/db/tenant";

export type Asset = typeof tenantSchema.assets.$inferSelect;
export type MaintenanceTask = typeof tenantSchema.maintenanceTasks.$inferSelect;

export type TaskWithAsset = {
  id: string;
  assetId: string | null;
  assetName: string | null;       // null si no tiene activo vinculado
  title: string;
  description: string | null;
  type: string;                   // preventive | corrective
  priority: string;               // low | medium | high | urgent
  status: string;                 // pending | in_progress | completed | cancelled
  assignedTo: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledDate: number | null;
  completedDate: number | null;
  isOverdue: boolean;             // scheduledDate < now && status not completed/cancelled
  createdAt: number;
};

export type MantenimientoKPIs = {
  operationalCount: number;
  maintenanceCount: number;
  offlineCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
};
