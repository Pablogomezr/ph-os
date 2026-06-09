/**
 * Helpers de autenticación para el Portal de Residentes.
 * SOLO importar en Server Components y Route Handlers.
 *
 * Estrategia: el admin crea el residente con email.
 * Cuando el residente hace login con Clerk, buscamos su email
 * en la DB del edificio — sin cambios de schema.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, and } from "drizzle-orm";
import type { User } from "@/lib/db/schema/tenant";

export type ResidentContext = {
  user:    User;
  unitIds: string[];
  slug:    string;
};

/**
 * Devuelve el contexto del residente autenticado para un edificio dado.
 * - Busca por email (Clerk → tenant DB).
 * - Devuelve null si no está autenticado, no tiene email, o no está
 *   registrado / activo en este edificio.
 */
export async function getResidentContext(
  slug: string
): Promise<ResidentContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return null;

  const db = await getTenantDb(slug);

  const user = await db
    .select()
    .from(tenantSchema.users)
    .where(
      and(
        eq(tenantSchema.users.email, email),
        eq(tenantSchema.users.active, 1)
      )
    )
    .get();

  if (!user) return null;

  let unitIds: string[] = [];
  try { unitIds = JSON.parse(user.unitIds ?? "[]"); } catch {}

  return { user, unitIds, slug };
}

/**
 * Igual que getResidentContext pero lanza un redirect si no está registrado.
 * Usar en page.tsx que requieren el contexto de forma obligatoria.
 */
export async function requireResidentContext(
  slug: string
): Promise<ResidentContext> {
  const ctx = await getResidentContext(slug);
  if (!ctx) {
    const { redirect } = await import("next/navigation");
    redirect(`/r/${slug}/no-registrado`);
    // redirect() throws internally — TypeScript needs the cast
    throw new Error("unreachable");
  }
  return ctx;
}
