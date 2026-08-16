/**
 * Auth helpers para el Portal del Operador.
 * El operador es un usuario con role="operator" en la DB del edificio.
 * Se identifica por email (Clerk → tenant DB), igual que el residente.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { eq, and } from "drizzle-orm";
import type { User } from "@/lib/db/schema/tenant";

export type OperatorContext = {
  user: User;
  slug: string;
};

export async function getOperatorContext(
  slug: string
): Promise<OperatorContext | null> {
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
        eq(tenantSchema.users.role, "operator"),
        eq(tenantSchema.users.active, 1)
      )
    )
    .get();

  if (!user) return null;
  return { user, slug };
}

export async function requireOperatorContext(
  slug: string
): Promise<OperatorContext> {
  const ctx = await getOperatorContext(slug);
  if (!ctx) {
    const { redirect } = await import("next/navigation");
    redirect(`/sign-in?redirect_url=/op/${slug}/lecturas`);
    throw new Error("unreachable");
  }
  return ctx;
}
