import type { tenantSchema } from "@/lib/db/tenant";

export type Communication = typeof tenantSchema.communications.$inferSelect;

export type ComunicadoView = {
  id: string;
  ticketNumber: number;
  title: string;
  body: string;
  type: string;          // announcement | circular | acta | invoice
  targetRoles: string[]; // parsed JSON
  // Si tiene elementos, el comunicado se dirige SOLO a estos residentes
  // puntuales (ignora targetRoles) — nombres ya resueltos para mostrar en UI.
  targetUsers: { id: string; name: string }[];
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
