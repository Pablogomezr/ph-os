"use server";

import { requireAccesoPanel } from "@/lib/auth/helpers";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type ResidentFormState = { error?: string; success?: boolean } | null;

export async function createResident(
  slug: string,
  _prev: ResidentFormState,
  formData: FormData
): Promise<ResidentFormState> {
  const { userId } = await requireAccesoPanel(slug);

  const name    = (formData.get("name") as string)?.trim();
  const email   = (formData.get("email") as string)?.trim().toLowerCase();
  const role    = (formData.get("role") as string) || "resident";
  const phone   = (formData.get("phone") as string)?.trim() || null;
  const unitIds = formData.getAll("unitIds") as string[];

  if (!name)  return { error: "El nombre es requerido." };
  if (!email) return { error: "El email es requerido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." };
  }

  const db = await getTenantDb(slug);

  // Email único por edificio
  const existing = await db
    .select({ id: tenantSchema.users.id })
    .from(tenantSchema.users)
    .where(eq(tenantSchema.users.email, email))
    .get();

  if (existing) return { error: `El email "${email}" ya está registrado en este edificio.` };

  const now = Math.floor(Date.now() / 1000);

  await db.insert(tenantSchema.users).values({
    id:        crypto.randomUUID(),
    name,
    email,
    role,
    phone,
    unitIds: JSON.stringify(unitIds),
    active:    1,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/e/${slug}/residentes`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

export async function updateResident(
  slug: string,
  residentId: string,
  _prev: ResidentFormState,
  formData: FormData
): Promise<ResidentFormState> {
  const { userId } = await requireAccesoPanel(slug);

  const name    = (formData.get("name") as string)?.trim();
  const email   = (formData.get("email") as string)?.trim().toLowerCase();
  const role    = (formData.get("role") as string) || "resident";
  const phone   = (formData.get("phone") as string)?.trim() || null;
  const unitIds = formData.getAll("unitIds") as string[];

  if (!name)  return { error: "El nombre es requerido." };
  if (!email) return { error: "El email es requerido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." };
  }

  const db = await getTenantDb(slug);

  // Email único por edificio (excluyendo el propio registro)
  const existing = await db
    .select({ id: tenantSchema.users.id })
    .from(tenantSchema.users)
    .where(eq(tenantSchema.users.email, email))
    .get();

  if (existing && existing.id !== residentId) {
    return { error: `El email "${email}" ya está registrado en este edificio.` };
  }

  await db.update(tenantSchema.users).set({
    name,
    email,
    role,
    phone,
    unitIds: JSON.stringify(unitIds),
    updatedAt: Math.floor(Date.now() / 1000),
  }).where(eq(tenantSchema.users.id, residentId));

  revalidatePath(`/e/${slug}/residentes`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

export async function deleteResident(slug: string, residentId: string) {
  const { userId } = await requireAccesoPanel(slug);

  const db = await getTenantDb(slug);
  await db.delete(tenantSchema.users).where(eq(tenantSchema.users.id, residentId));

  revalidatePath(`/e/${slug}/residentes`);
  revalidatePath(`/e/${slug}/dashboard`);
}

export async function toggleResidentActive(slug: string, residentId: string, active: boolean) {
  const { userId } = await requireAccesoPanel(slug);

  const db = await getTenantDb(slug);
  await db
    .update(tenantSchema.users)
    .set({ active: active ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(tenantSchema.users.id, residentId));

  revalidatePath(`/e/${slug}/residentes`);
}
