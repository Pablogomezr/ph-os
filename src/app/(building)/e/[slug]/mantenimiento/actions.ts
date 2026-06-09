"use server";

import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type AssetFormState  = { error?: string; success?: boolean } | null;
export type TaskFormState   = { error?: string; success?: boolean } | null;

// ─── Crear Activo ─────────────────────────────────────────────────────────────
export async function createAsset(
  slug: string,
  _prev: AssetFormState,
  formData: FormData
): Promise<AssetFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const name          = (formData.get("name")          as string)?.trim();
  const category      = (formData.get("category")      as string)?.trim();
  const brand         = (formData.get("brand")         as string)?.trim() || null;
  const model         = (formData.get("model")         as string)?.trim() || null;
  const serialNumber  = (formData.get("serialNumber")  as string)?.trim() || null;
  const location      = (formData.get("location")      as string)?.trim() || null;
  const notes         = (formData.get("notes")         as string)?.trim() || null;
  const nextMaintRaw  =  formData.get("nextMaintenance") as string;

  if (!name)     return { error: "El nombre del activo es requerido." };
  if (!category) return { error: "Selecciona una categoría." };

  const nextMaintenance = nextMaintRaw
    ? Math.floor(new Date(nextMaintRaw + "T12:00:00").getTime() / 1000)
    : null;

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db.insert(tenantSchema.assets).values({
    id:              crypto.randomUUID(),
    name,
    category,
    brand,
    model,
    serialNumber,
    location,
    nextMaintenance,
    notes,
    status:    "operational",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/e/${slug}/mantenimiento`);
  return { success: true };
}

// ─── Actualizar estado de activo ──────────────────────────────────────────────
export async function updateAssetStatus(
  slug: string,
  assetId: string,
  status: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const validStatuses = ["operational", "maintenance", "offline"];
  if (!validStatuses.includes(status)) return;

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db
    .update(tenantSchema.assets)
    .set({ status, updatedAt: now })
    .where(eq(tenantSchema.assets.id, assetId));

  revalidatePath(`/e/${slug}/mantenimiento`);
}

// ─── Eliminar activo ──────────────────────────────────────────────────────────
export async function deleteAsset(slug: string, assetId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  // Solo eliminar si no tiene tareas activas
  const taskCount = await db
    .select({ id: tenantSchema.maintenanceTasks.id })
    .from(tenantSchema.maintenanceTasks)
    .where(eq(tenantSchema.maintenanceTasks.assetId, assetId))
    .all();

  if (taskCount.length > 0) return; // silently skip — tiene tareas

  await db.delete(tenantSchema.assets).where(eq(tenantSchema.assets.id, assetId));
  revalidatePath(`/e/${slug}/mantenimiento`);
}

// ─── Crear Tarea ──────────────────────────────────────────────────────────────
export async function createTask(
  slug: string,
  _prev: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const title           = (formData.get("title")          as string)?.trim();
  const description     = (formData.get("description")    as string)?.trim() || null;
  const assetId         = (formData.get("assetId")        as string)?.trim() || null;
  const type            = (formData.get("type")           as string)?.trim();
  const priority        = (formData.get("priority")       as string)?.trim() || "medium";
  const assignedTo      = (formData.get("assignedTo")     as string)?.trim() || null;
  const estimatedCostRaw = formData.get("estimatedCost")  as string;
  const scheduledDateRaw = formData.get("scheduledDate")  as string;

  if (!title) return { error: "El título de la tarea es requerido." };
  if (!type)  return { error: "Selecciona el tipo de mantenimiento." };

  const estimatedCost = estimatedCostRaw ? parseFloat(estimatedCostRaw) : null;
  const scheduledDate = scheduledDateRaw
    ? Math.floor(new Date(scheduledDateRaw + "T12:00:00").getTime() / 1000)
    : null;

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db.insert(tenantSchema.maintenanceTasks).values({
    id:          crypto.randomUUID(),
    assetId:     assetId || null,
    title,
    description,
    type,
    priority,
    status:      "pending",
    assignedTo,
    estimatedCost,
    scheduledDate,
    createdBy:   userId,
    createdAt:   now,
    updatedAt:   now,
  });

  revalidatePath(`/e/${slug}/mantenimiento`);
  return { success: true };
}

// ─── Actualizar estado de tarea ───────────────────────────────────────────────
export async function updateTaskStatus(
  slug: string,
  taskId: string,
  status: string
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const validStatuses = ["pending", "in_progress", "completed", "cancelled"];
  if (!validStatuses.includes(status)) return;

  const now = Math.floor(Date.now() / 1000);
  const db  = await getTenantDb(slug);

  await db
    .update(tenantSchema.maintenanceTasks)
    .set({
      status,
      completedDate: status === "completed" ? now : null,
      updatedAt:     now,
    })
    .where(eq(tenantSchema.maintenanceTasks.id, taskId));

  revalidatePath(`/e/${slug}/mantenimiento`);
}

// ─── Eliminar tarea ───────────────────────────────────────────────────────────
export async function deleteTask(slug: string, taskId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = await getTenantDb(slug);

  await db
    .delete(tenantSchema.maintenanceTasks)
    .where(eq(tenantSchema.maintenanceTasks.id, taskId));

  revalidatePath(`/e/${slug}/mantenimiento`);
}
