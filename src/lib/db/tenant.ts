import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "./superadmin";
import * as tenantSchema from "./schema/tenant";

/**
 * FUNCIÓN CORE DE MULTI-TENANCY
 *
 * getTenantDb(buildingSlug) — retorna una instancia de Drizzle conectada
 * a la base de datos Turso del edificio específico.
 *
 * REGLA: Siempre usar esta función para queries de edificio.
 * NUNCA hardcodear credenciales de Turso — siempre resolverlas por slug.
 * NUNCA exponer turso_db_url ni turso_auth_token al cliente.
 */

// Cache de conexiones por slug para evitar crear una nueva conexión en cada request
const tenantConnections = new Map<string, ReturnType<typeof drizzle>>();

export async function getTenantDb(buildingSlug: string) {
  // Retornar conexión cacheada si existe
  if (tenantConnections.has(buildingSlug)) {
    return tenantConnections.get(buildingSlug)!;
  }

  // Buscar el edificio en la DB central
  const centralDb = getSuperadminDb();
  const building = await centralDb
    .select({
      tursoDbUrl: superadminSchema.buildings.tursoDbUrl,
      tursoAuthToken: superadminSchema.buildings.tursoAuthToken,
      status: superadminSchema.buildings.status,
    })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, buildingSlug))
    .get();

  if (!building) {
    throw new Error(`Edificio no encontrado: ${buildingSlug}`);
  }

  if (building.status === "suspended") {
    throw new Error(`Edificio suspendido: ${buildingSlug}`);
  }

  // Crear conexión a la DB del edificio
  const client = createClient({
    url: building.tursoDbUrl,
    authToken: building.tursoAuthToken,
  });

  const db = drizzle(client, { schema: tenantSchema });

  // Cachear para reuso
  tenantConnections.set(buildingSlug, db);

  return db;
}

/**
 * Helper para limpiar el cache (útil en tests y desarrollo)
 */
export function clearTenantCache(slug?: string) {
  if (slug) {
    tenantConnections.delete(slug);
  } else {
    tenantConnections.clear();
  }
}

export { tenantSchema };
