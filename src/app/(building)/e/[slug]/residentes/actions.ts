"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type ResidentFormState = { error?: string; success?: boolean } | null;

export async function createResident(
  slug: string,
  _prev: ResidentFormState,
  formData: FormData
): Promise<ResidentFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name    = (formData.get("name") as string)?.trim();
  const email   = (formData.get("email") as string)?.trim().toLowerCase();
  const role    = (formData.get("role") as string) || "resident";
  const phone   = (formData.get("phone") as string)?.trim() || null;
  const unitId  = (formData.get("unitId") as string)?.trim() || null;

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
  const unitIds = unitId ? JSON.stringify([unitId]) : "[]";

  await db.insert(tenantSchema.users).values({
    id:        crypto.randomUUID(),
    name,
    email,
    role,
    phone,
    unitIds,
    active:    1,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/e/${slug}/residentes`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

export async function deleteResident(slug: string, residentId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);
  await db.delete(tenantSchema.users).where(eq(tenantSchema.users.id, residentId));

  revalidatePath(`/e/${slug}/residentes`);
  revalidatePath(`/e/${slug}/dashboard`);
}

export async function toggleResidentActive(slug: string, residentId: string, active: boolean) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);
  await db
    .update(tenantSchema.users)
    .set({ active: active ? 1 : 0, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(tenantSchema.users.id, residentId));

  revalidatePath(`/e/${slug}/residentes`);
}
