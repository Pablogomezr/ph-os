"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { requireOperatorContext } from "@/lib/operator-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type OperatorReadingState = { error?: string; success?: boolean; unitId?: string } | null;

export async function saveOperatorReading(
  slug: string,
  _prev: OperatorReadingState,
  formData: FormData
): Promise<OperatorReadingState> {
  // Solo un operario activo de ESTE edificio; la acción se puede invocar con cualquier slug.
  await requireOperatorContext(slug);
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const unitId         = (formData.get("unitId")          as string)?.trim();
  const meterNumber    = (formData.get("meterNumber")     as string)?.trim() || null;
  const prevReadingRaw =  formData.get("previousReading") as string;
  const currReadingRaw =  formData.get("currentReading")  as string;
  const rateRaw        =  formData.get("ratePerKwh")      as string;
  const readingDateStr =  formData.get("readingDate")     as string;

  if (!unitId)         return { error: "Unidad no especificada." };
  if (!readingDateStr) return { error: "Fecha requerida." };

  const previousReading = parseFloat(prevReadingRaw);
  const currentReading  = parseFloat(currReadingRaw);
  const ratePerKwh      = parseFloat(rateRaw) || 800;

  if (isNaN(previousReading) || previousReading < 0)
    return { error: "Lectura anterior inválida." };
  if (isNaN(currentReading) || currentReading < 0)
    return { error: "Lectura actual inválida." };
  if (currentReading < previousReading)
    return { error: "La lectura actual no puede ser menor que la anterior." };

  const readingDate = Math.floor(new Date(readingDateStr + "T12:00:00").getTime() / 1000);
  const now         = Math.floor(Date.now() / 1000);

  const db = await getTenantDb(slug);
  await db.insert(tenantSchema.energyReadings).values({
    id:              crypto.randomUUID(),
    unitId,
    meterNumber,
    previousReading,
    currentReading,
    ratePerKwh,
    readingDate,
    createdBy:       userId,
    createdAt:       now,
  });

  revalidatePath(`/op/${slug}/lecturas`);
  revalidatePath(`/e/${slug}/energia`);
  return { success: true, unitId };
}
