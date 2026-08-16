"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { uploadAttachments } from "@/lib/blob-upload";
import type { ComunicadoFormState } from "./types";

// ─── Crear comunicado (queda como borrador) ───────────────────────────────────
export async function createComunicado(
  slug: string,
  _prev: ComunicadoFormState,
  formData: FormData
): Promise<ComunicadoFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const title       = (formData.get("title")       as string)?.trim();
  const body        = (formData.get("body")        as string)?.trim();
  const type        = (formData.get("type")        as string)?.trim();
  const targetMode  = (formData.get("targetMode")  as string) || "role";
  const targetRoles = (formData.get("targetRoles") as string)?.trim() || '["all"]';
  const targetUserIds = formData.getAll("targetUserIds") as string[];

  if (!title) return { error: "El título es requerido." };
  if (!body)  return { error: "El cuerpo del comunicado es requerido." };
  if (!type)  return { error: "Selecciona el tipo de comunicado." };
  if (targetMode === "specific" && targetUserIds.length === 0) {
    return { error: "Selecciona al menos un arrendatario para envío puntual." };
  }

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);
  const attachmentUrls = files.length > 0
    ? await uploadAttachments(files, `comunicados/${slug}`)
    : [];

  await db.insert(tenantSchema.communications).values({
    id:             crypto.randomUUID(),
    title,
    body,
    type,
    targetRoles: targetMode === "specific" ? '["tenant"]' : targetRoles,
    targetUserIds: targetMode === "specific" ? JSON.stringify(targetUserIds) : null,
    attachmentUrls: JSON.stringify(attachmentUrls),
    createdBy:      userId,
    createdAt:      now,
  });

  revalidatePath(`/e/${slug}/mensajeria`);
  return { success: true };
}

// ─── Editar comunicado (borrador o ya publicado) ──────────────────────────────
export async function updateComunicado(
  slug: string,
  _prev: ComunicadoFormState,
  formData: FormData
): Promise<ComunicadoFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const id          = (formData.get("id")          as string)?.trim();
  const title       = (formData.get("title")       as string)?.trim();
  const body        = (formData.get("body")        as string)?.trim();
  const type        = (formData.get("type")        as string)?.trim();
  const targetMode  = (formData.get("targetMode")  as string) || "role";
  const targetRoles = (formData.get("targetRoles") as string)?.trim() || '["all"]';
  const targetUserIds = formData.getAll("targetUserIds") as string[];

  if (!id)    return { error: "Comunicado no identificado." };
  if (!title) return { error: "El título es requerido." };
  if (!body)  return { error: "El cuerpo del comunicado es requerido." };
  if (!type)  return { error: "Selecciona el tipo de comunicado." };
  if (targetMode === "specific" && targetUserIds.length === 0) {
    return { error: "Selecciona al menos un arrendatario para envío puntual." };
  }

  const db = await getTenantDb(slug);

  // Adjuntos NUEVOS se agregan a los existentes (no reemplazan).
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File);
  let attachmentUpdate: { attachmentUrls: string } | undefined;
  if (files.length > 0) {
    const existing = await db
      .select({ a: tenantSchema.communications.attachmentUrls })
      .from(tenantSchema.communications)
      .where(eq(tenantSchema.communications.id, id))
      .get();
    let prevUrls: string[] = [];
    try { prevUrls = JSON.parse(existing?.a ?? "[]"); } catch {}
    const newUrls = await uploadAttachments(files, `comunicados/${slug}`);
    attachmentUpdate = { attachmentUrls: JSON.stringify([...prevUrls, ...newUrls]) };
  }

  await db
    .update(tenantSchema.communications)
    .set({
      title,
      body,
      type,
      targetRoles:   targetMode === "specific" ? '["tenant"]' : targetRoles,
      targetUserIds: targetMode === "specific" ? JSON.stringify(targetUserIds) : null,
      ...(attachmentUpdate ?? {}),
    })
    .where(eq(tenantSchema.communications.id, id));

  revalidatePath(`/e/${slug}/mensajeria`);
  return { success: true };
}

// ─── Publicar comunicado ──────────────────────────────────────────────────────
export async function publishComunicado(
  slug: string,
  id: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db
    .update(tenantSchema.communications)
    .set({ publishedAt: now })
    .where(eq(tenantSchema.communications.id, id));

  revalidatePath(`/e/${slug}/mensajeria`);
}

// ─── Despublicar (volver a borrador) ─────────────────────────────────────────
export async function unpublishComunicado(
  slug: string,
  id: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  await db
    .update(tenantSchema.communications)
    .set({ publishedAt: null })
    .where(eq(tenantSchema.communications.id, id));

  revalidatePath(`/e/${slug}/mensajeria`);
}

// ─── Eliminar comunicado ──────────────────────────────────────────────────────
export async function deleteComunicado(
  slug: string,
  id: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);
  await db
    .delete(tenantSchema.communications)
    .where(eq(tenantSchema.communications.id, id));

  revalidatePath(`/e/${slug}/mensajeria`);
}
