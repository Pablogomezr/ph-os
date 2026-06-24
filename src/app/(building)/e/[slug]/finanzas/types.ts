import type { tenantSchema } from "@/lib/db/tenant";

export type Unit         = typeof tenantSchema.units.$inferSelect;
export type ResidentUser = typeof tenantSchema.users.$inferSelect;

export type ChargeWithUnit = {
  id: string;
  unitId: string;
  unitNumber: string;
  concept: string;
  specificConcept: string | null;
  description: string | null;
  amount: number;
  dueDate: number;
  status: string;
  effectiveStatus: string; // "overdue" si pending + dueDate < now
  paidAmount: number;      // suma de pagos ya registrados
  isMass: number;
  batchId: string | null;
  createdAt: number;
};

export type KPIs = {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number; // 0-100
};
