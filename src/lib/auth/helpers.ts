import { auth, currentUser } from "@clerk/nextjs/server";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { decidirAccesoPanel, type MiembroEdificio } from "@/lib/auth/acceso";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

/**
 * Obtiene el edificio por slug desde la DB central.
 * Lanza error si no existe.
 */
export async function getBuilding(slug: string) {
  const db = getSuperadminDb();
  const building = await db
    .select()
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, slug))
    .get();

  if (!building) {
    throw new Error(`Edificio no encontrado: ${slug}`);
  }

  return building;
}

export class AccesoDenegado extends Error {
  constructor(readonly motivo: string) {
    super("No autorizado para este edificio");
  }
}

/**
 * Evalúa si la sesión actual puede usar el panel de administración de `slug`.
 * Ver la regla en `@/lib/auth/acceso`. El miembro se busca por el email
 * PRIMARIO y VERIFICADO de Clerk en la tabla `users` de ese edificio.
 */
export const evaluarAccesoPanel = cache(async (slug: string) => {
  const { userId } = await auth();
  const superadminId = process.env.SUPERADMIN_USER_ID;
  const isSuperadmin = !!userId && !!superadminId && userId === superadminId;

  let email: string | null = null;
  let miembro: MiembroEdificio = null;

  if (userId && !isSuperadmin) {
    const user = await currentUser();
    const primario = user?.primaryEmailAddress;
    if (primario?.verification?.status === "verified") {
      email = primario.emailAddress.toLowerCase();
      const db = await getTenantDb(slug);
      miembro =
        (await db
          .select({ role: tenantSchema.users.role, active: tenantSchema.users.active })
          .from(tenantSchema.users)
          .where(eq(tenantSchema.users.email, email))
          .get()) ?? null;
    }
  }

  const decision = decidirAccesoPanel({ userId: userId ?? null, superadminId, miembro });
  return { decision, userId: userId ?? null, isSuperadmin, email };
});

/**
 * Para cada page.tsx del panel. El layout no basta: un page segment se puede
 * pedir por RSC sin que el layout se vuelva a ejecutar.
 */
export async function requireAccesoPanelPagina(slug: string): Promise<void> {
  const { decision } = await evaluarAccesoPanel(slug);
  if (decision.permitido) return;
  if (decision.motivo === "sin-sesion") redirect(`/sign-in?redirect_url=/e/${slug}/dashboard`);
  if (decision.motivo === "portal-residente") redirect(`/r/${slug}/dashboard`);
  if (decision.motivo === "portal-operario") redirect(`/op/${slug}/lecturas`);
  notFound();
}

/** Para route handlers: true solo si la sesión es personal de ESTE edificio. */
export async function tieneAccesoPanel(slug: string): Promise<boolean> {
  try {
    return (await evaluarAccesoPanel(slug)).decision.permitido;
  } catch {
    return false; // slug inexistente o base caída: falla cerrado
  }
}

/**
 * Para Server Actions y route handlers del panel: lanza AccesoDenegado si la
 * sesión no es personal de ESTE edificio. El middleware y el layout no
 * protegen una Server Action: se puede invocar directamente con cualquier slug.
 */
export async function requireAccesoPanel(slug: string): Promise<{ userId: string; isSuperadmin: boolean }> {
  const { decision, userId, isSuperadmin } = await evaluarAccesoPanel(slug);
  if (!decision.permitido || !userId) {
    throw new AccesoDenegado(decision.permitido ? "sin-sesion" : decision.motivo);
  }
  return { userId, isSuperadmin };
}

/**
 * Requiere superadmin. Para rutas /superadmin/*
 */
export async function requireSuperadmin() {
  const { userId } = await auth();

  if (!userId || userId !== process.env.SUPERADMIN_USER_ID) {
    redirect("/");
  }

  return userId;
}
