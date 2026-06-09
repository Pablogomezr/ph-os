import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema/superadmin";

/**
 * Conexión a la DB central (superadmin).
 * Contiene la tabla `buildings` con metadatos de todos los edificios.
 * NUNCA exponer al cliente — solo server-side.
 */

let _superadminDb: ReturnType<typeof drizzle> | null = null;

export function getSuperadminDb() {
  if (_superadminDb) return _superadminDb;

  if (!process.env.TURSO_CENTRAL_URL || !process.env.TURSO_CENTRAL_AUTH_TOKEN) {
    throw new Error(
      "TURSO_CENTRAL_URL y TURSO_CENTRAL_AUTH_TOKEN son requeridos. Configura .env.local"
    );
  }

  const client = createClient({
    url: process.env.TURSO_CENTRAL_URL,
    authToken: process.env.TURSO_CENTRAL_AUTH_TOKEN,
  });

  _superadminDb = drizzle(client, { schema });
  return _superadminDb;
}

export { schema as superadminSchema };
