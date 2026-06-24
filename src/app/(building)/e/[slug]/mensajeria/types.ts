import type { tenantSchema } from "@/lib/db/tenant";

export type Communication = typeof tenantSchema.communications.$inferSelect;

export type ComunicadoView = {
  id: string;
  ticketNumber: number;
  title: string;
  body: string;
  type: string;          // announcement | circular | acta | invoice
  targetRoles: string[]; // parsed JSON
  attachmentUrls: string[];
  publishedAt: number | null;
  isPublished: boolean;
  createdBy: string;
  createdAt: number;
};

export type ComunicadosKPIs = {
  total: number;
  published: number;
  drafts: number;
  announcements: number;
  circulars: number;
};

export type ComunicadoFormState = { error?: string; success?: boolean } | null;
