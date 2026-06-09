"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { getResidentContext } from "@/lib/resident-auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

export type PqrsResidentState = { error?: string; success?: boolean } | null;

export async function createResidentPqrs(
  slug: string,
  _prev: PqrsResidentState,
  formData: FormData
): Promise<PqrsResidentState> {
  const ctx = await getResidentContext(slug);
  if (!ctx) return { error: "No autorizado. Tu sesión puede haber expirado." };

  const type        = (formData.get("type") as string)?.trim();
  const subject     = (formData.get("subject") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const unitId      = (formData.get("unitId") as string)?.trim() || ctx.unitIds[0];

  if (!type)        return { error: "Selecciona el tipo de solicitud." };
  if (!subject)     return { error: "El asunto es requerido." };
  if (!description) return { error: "La descripción es requerida." };
  if (!unitId)      return { error: "No tienes una unidad registrada. Contacta a la administración." };

  const db  = await getTenantDb(slug);
  const now = Math.floor(Date.now() / 1000);

  await db.insert(tenantSchema.pqrs).values({
    id:          nanoid(),
    unitId,
    userId:      ctx.user.id,
    type,
    subject,
    description,
    status:      "open",
    priority:    "normal",
    response:    null,
    resolvedAt:  null,
    createdAt:   now,
    updatedAt:   now,
  });

  revalidatePath(`/r/${slug}/pqrs`);
  return { success: true };
}
