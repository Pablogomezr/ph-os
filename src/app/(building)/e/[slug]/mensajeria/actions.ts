"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  const targetRoles = (formData.get("targetRoles") as string)?.trim() || '["all"]';

  if (!title) return { error: "El título es requerido." };
  if (!body)  return { error: "El cuerpo del comunicado es requerido." };
  if (!type)  return { error: "Selecciona el tipo de comunicado." };

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db.insert(tenantSchema.communications).values({
    id:          crypto.randomUUID(),
    title,
    body,
    type,
    targetRoles,
    createdBy:   userId,
    createdAt:   now,
  });

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
