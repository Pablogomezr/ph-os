import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, sql } from "drizzle-orm";

// Fuera de actions.ts a propósito: todo export de un archivo "use server" es
// un endpoint público. Esta función la llaman acciones que ya verificaron acceso.

// Recalcula y guarda el estado del cargo (paid/partial/pending) según la
// suma actual de sus pagos — usado tras editar o eliminar un pago.
export async function recalcChargeStatus(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  chargeId: string
): Promise<void> {
  const charge = await db
    .select({ amount: tenantSchema.charges.amount })
    .from(tenantSchema.charges)
    .where(eq(tenantSchema.charges.id, chargeId))
    .get();
  if (!charge) return;

  const totalResult = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(tenantSchema.payments)
    .where(eq(tenantSchema.payments.chargeId, chargeId))
    .get();
  const totalPaid = totalResult?.total ?? 0;

  const status = totalPaid <= 0 ? "pending" : totalPaid >= charge.amount - 0.01 ? "paid" : "partial";
  await db
    .update(tenantSchema.charges)
    .set({ status, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(tenantSchema.charges.id, chargeId));
}
