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
  reference: string | null; // número de documento contable — FV-1234, rc-5678, NC-90, etc.
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

export type PendingReviewPayment = {
  id: string;
  unitId: string;
  unitNumber: string;
  amount: number;
  paymentDate: number;
  reference: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: number;
  reportedByName: string | null;
  reportedByPhone: string | null;
};

export type ChargeMatchCandidate = {
  chargeId: string;
  unitId: string;
  unitNumber: string;
  concept: string;
  reference: string | null; // documento FV/NC del cargo
  remaining: number;
};

export type BankMovementRow = {
  id: string;
  date: number;
  amount: number;
  reference: string;
  description: string;
  matched: boolean; // ya vinculado a un pago (payments.matchedMovementId)
  candidates: ChargeMatchCandidate[]; // cargos pendientes cuyo saldo coincide exacto con el monto
  referenceUnits: string[];             // unidades reconocidas por alias de referencia
  referenceCharges: ChargeMatchCandidate[]; // cargos pendientes de esas unidades (para aplicar/dividir)
};

export type PaymentRow = {
  id: string;
  chargeId: string;
  unitId: string;
  unitNumber: string;
  concept: string;
  chargeAmount: number;
  amount: number;
  paymentDate: number;
  method: string;
  reference: string | null;
  notes: string | null;
  receiptUrl: string | null;
  bankStatus: string;
  createdAt: number;
};
