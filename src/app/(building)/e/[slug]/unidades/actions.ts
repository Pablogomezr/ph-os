"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type UnitFormState = { error?: string; success?: boolean } | null;

export async function createUnit(
  slug: string,
  _prev: UnitFormState,
  formData: FormData
): Promise<UnitFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const number      = (formData.get("number") as string)?.trim();
  const type        = (formData.get("type") as string) || "apartment";
  const floorRaw    = formData.get("floor") as string;
  const areaRaw     = formData.get("area") as string;
  const coeffRaw    = formData.get("coefficient") as string;
  const status      = (formData.get("status") as string) || "occupied";

  if (!number)       return { error: "El número de unidad es requerido." };
  if (!coeffRaw)     return { error: "El coeficiente es requerido." };

  const coefficient = parseFloat(coeffRaw);
  if (isNaN(coefficient) || coefficient <= 0 || coefficient > 1) {
    return { error: "El coeficiente debe ser un número entre 0 y 1." };
  }

  const floor  = floorRaw  ? parseInt(floorRaw)  : null;
  const areaMq = areaRaw   ? parseFloat(areaRaw) : null;

  // Verificar número único en este edificio
  const db = await getTenantDb(slug);
  const existing = await db
    .select({ id: tenantSchema.units.id })
    .from(tenantSchema.units)
    .where(eq(tenantSchema.units.number, number))
    .get();

  if (existing) return { error: `La unidad "${number}" ya existe en este edificio.` };

  const now = Math.floor(Date.now() / 1000);
  await db.insert(tenantSchema.units).values({
    id:          crypto.randomUUID(),
    number,
    type,
    floor,
    areaMq,
    coefficient,
    status,
    parkingSpots: "[]",
    createdAt:   now,
    updatedAt:   now,
  });

  revalidatePath(`/e/${slug}/unidades`);
  revalidatePath(`/e/${slug}/dashboard`);
  return { success: true };
}

export async function deleteUnit(slug: string, unitId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);
  await db.delete(tenantSchema.units).where(eq(tenantSchema.units.id, unitId));

  revalidatePath(`/e/${slug}/unidades`);
  revalidatePath(`/e/${slug}/dashboard`);
}
