import type { tenantSchema } from "@/lib/db/tenant";

export type Unit = typeof tenantSchema.units.$inferSelect;

export type PqrsWithUnit = {
  id: string;
  ticketNumber: number;
  unitId: string;
  unitNumber: string;
  userId: string;
  type: string;        // petition | complaint | claim | suggestion
  subject: string;
  description: string;
  status: string;      // open | in_review | resolved | closed
  priority: string;    // low | normal | high | urgent
  response: string | null;
  attachments: string[];
  resolvedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type PqrsFormState     = { error?: string; success?: boolean } | null;
export type PqrsResponseState = { error?: string; success?: boolean } | null;

export type PqrsKPIs = {
  total: number;
  open: number;
  inReview: number;
  resolved: number;
  closed: number;
};
