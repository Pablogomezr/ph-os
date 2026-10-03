import { auth, currentUser } from "@clerk/nextjs/server";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { getTenantDb, tenantSchema } from "@/lib/db/tenant";
import { decidirAccesoPanel, seccionesPermitidas, type MiembroEdificio, type Seccion } from "@/lib/auth/acceso";
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
 * Sesión de Clerk + fila de `users` del edificio. Cacheada por request, así el
 * layout y la página no consultan dos veces. El miembro se busca por el email
 * PRIMARIO y VERIFICADO de Clerk en la tabla `users` de ese edificio.
 */
const cargarSesionPanel = cache(async (slug: string) => {
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

  return { userId: userId ?? null, superadminId, isSuperadmin, email, miembro };
});

/**
 * Evalúa si la sesión actual puede usar el panel de `slug` y, si se pasa,
 * esa `seccion`. La regla está en `@/lib/auth/acceso`.
 */
export async function evaluarAccesoPanel(slug: string, seccion?: Seccion) {
  const s = await cargarSesionPanel(slug);
  const decision = decidirAccesoPanel({ userId: s.userId, superadminId: s.superadminId, miembro: s.miembro, seccion });
  // null = superadmin, ve todo
  const rol = s.isSuperadmin ? null : (s.miembro?.role ?? "");
  return { decision, userId: s.userId, isSuperadmin: s.isSuperadmin, email: s.email, secciones: seccionesPermitidas(rol) };
}

/**
 * Para cada page.tsx del panel. El layout no basta: un page segment se puede
 * pedir por RSC sin que el layout se vuelva a ejecutar.
 */
export async function requireAccesoPanelPagina(slug: string, seccion: Seccion): Promise<void> {
  const { decision, secciones } = await evaluarAccesoPanel(slug, seccion);
  if (decision.permitido) return;
  if (decision.motivo === "sin-sesion") redirect(`/sign-in?redirect_url=/e/${slug}/${seccion}`);
  if (decision.motivo === "portal-residente") redirect(`/r/${slug}/dashboard`);
  if (decision.motivo === "portal-operario") redirect(`/op/${slug}/lecturas`);
  if (decision.motivo === "seccion-restringida" && secciones.length > 0) redirect(`/e/${slug}/${secciones[0]}`);
  notFound();
}

/** Para route handlers: true solo si la sesión es personal de ESTE edificio con acceso a `seccion`. */
export async function tieneAccesoPanel(slug: string, seccion: Seccion): Promise<boolean> {
  try {
    return (await evaluarAccesoPanel(slug, seccion)).decision.permitido;
  } catch {
    return false; // slug inexistente o base caída: falla cerrado
  }
}

/**
 * Para Server Actions del panel: lanza AccesoDenegado si la sesión no es
 * personal de ESTE edificio con acceso a `seccion`. El middleware y el layout
 * no protegen una Server Action: se puede invocar directamente con cualquier slug.
 */
export async function requireAccesoPanel(slug: string, seccion: Seccion): Promise<{ userId: string; isSuperadmin: boolean }> {
  const { decision, userId, isSuperadmin } = await evaluarAccesoPanel(slug, seccion);
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
