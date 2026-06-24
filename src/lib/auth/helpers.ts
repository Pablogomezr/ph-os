import { auth, currentUser } from "@clerk/nextjs/server";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export type UserRole = "superadmin" | "admin" | "resident" | "tenant" | "technician";

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

/**
 * Retorna el rol del usuario en el edificio.
 * Orden de precedencia: superadmin > admin (Clerk org role) > resident
 */
export async function getUserRole(buildingSlug: string): Promise<UserRole> {
  const { userId, orgRole } = await auth();

  if (!userId) redirect("/sign-in");

  // Verificar superadmin
  if (userId === process.env.SUPERADMIN_USER_ID) {
    return "superadmin";
  }

  // Mapear rol de la org de Clerk
  if (orgRole === "org:admin") return "admin";
  if (orgRole === "org:technician") return "technician";

  return "resident";
}

/**
 * Requiere que el usuario esté autenticado y tenga el rol indicado.
 * Redirige si no tiene permisos.
 */
export async function requireRole(
  buildingSlug: string,
  requiredRole: UserRole | UserRole[]
): Promise<UserRole> {
  const role = await getUserRole(buildingSlug);
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  const roleHierarchy: UserRole[] = ["superadmin", "admin", "technician", "resident", "tenant"];
  const userLevel = roleHierarchy.indexOf(role);
  const hasAccess = allowedRoles.some((r) => roleHierarchy.indexOf(r) >= userLevel);

  if (!hasAccess) {
    redirect(`/${buildingSlug}/dashboard`);
  }

  return role;
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
