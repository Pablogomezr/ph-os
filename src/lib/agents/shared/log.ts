import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema/tenant";

export type TenantDb = LibSQLDatabase<typeof schema>;

/**
 * Bitácora de agentes — la evidencia ante el consejo de administración.
 *
 * REGLA: toda ejecución deja fila, incluidas las que NO hicieron nada. Un
 * agente que se calla cuando decide no actuar es indistinguible de un agente
 * caído. Por eso los omitidos se registran con su motivo.
 */

export type NivelAgente = "verde" | "amarillo" | "rojo";
export type ResultadoAgente = "ok" | "omitido" | "error";

export type EntradaBitacora = {
  agente: string;
  accion: string;
  nivel: NivelAgente;
  unidadId?: string | null;
  /** Qué vio el agente. */
  entrada?: unknown;
  /** Qué hizo. */
  salida?: unknown;
  resultado: ResultadoAgente;
  /** Motivo, separado del resultado para poder agrupar por causa. */
  motivo?: string | null;
  aprobadoPor?: string | null;
  ahora: number;
};

export async function registrarEnBitacora(db: TenantDb, e: EntradaBitacora): Promise<void> {
  await db.insert(schema.agentLog).values({
    id: crypto.randomUUID(),
    agent: e.agente,
    action: e.accion,
    level: e.nivel,
    unitId: e.unidadId ?? null,
    input: JSON.stringify(e.entrada ?? {}),
    output: JSON.stringify(e.salida ?? {}),
    result: e.resultado,
    reason: e.motivo ?? null,
    approvedBy: e.aprobadoPor ?? null,
    createdAt: e.ahora,
  });
}
