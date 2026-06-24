"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { uploadAttachments } from "@/lib/blob-upload";
import type { PqrsFormState, PqrsResponseState } from "./types";

// ─── Crear PQRS (admin registra en nombre de una unidad) ──────────────────────
export async function createPqrs(
  slug: string,
  _prev: PqrsFormState,
  formData: FormData
): Promise<PqrsFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const unitId      = (formData.get("unitId")      as string)?.trim();
  const type        = (formData.get("type")        as string)?.trim();
  const subject     = (formData.get("subject")     as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority    = (formData.get("priority")    as string)?.trim() || "normal";

  if (!unitId)      return { error: "Selecciona una unidad." };
  if (!type)        return { error: "Selecciona el tipo de solicitud." };
  if (!subject)     return { error: "El asunto es requerido." };
  if (!description) return { error: "La descripción es requerida." };

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);
  const attachmentUrls = files.length > 0
    ? await uploadAttachments(files, `pqrs/${slug}`)
    : [];

  await db.insert(tenantSchema.pqrs).values({
    id:          crypto.randomUUID(),
    unitId,
    userId,
    type,
    subject,
    description,
    priority,
    status:      "open",
    attachments: JSON.stringify(attachmentUrls),
    createdAt:   now,
    updatedAt:   now,
  });

  revalidatePath(`/e/${slug}/pqrs`);
  return { success: true };
}

// ─── Responder PQRS + cambiar estado ─────────────────────────────────────────
export async function respondPqrs(
  slug: string,
  _prev: PqrsResponseState,
  formData: FormData
): Promise<PqrsResponseState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const pqrsId  = (formData.get("pqrsId")   as string)?.trim();
  const response = (formData.get("response") as string)?.trim();
  const status   = (formData.get("status")   as string)?.trim();

  if (!pqrsId) return { error: "ID de solicitud inválido." };

  const validStatuses = ["open", "in_review", "resolved", "closed"];
  if (!validStatuses.includes(status)) return { error: "Estado inválido." };

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db
    .update(tenantSchema.pqrs)
    .set({
      response:   response || null,
      status,
      resolvedAt: status === "resolved" || status === "closed" ? now : null,
      updatedAt:  now,
    })
    .where(eq(tenantSchema.pqrs.id, pqrsId));

  revalidatePath(`/e/${slug}/pqrs`);
  return { success: true };
}

// ─── Eliminar PQRS ────────────────────────────────────────────────────────────
export async function deletePqrs(slug: string, pqrsId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);
  await db.delete(tenantSchema.pqrs).where(eq(tenantSchema.pqrs.id, pqrsId));
  revalidatePath(`/e/${slug}/pqrs`);
}
