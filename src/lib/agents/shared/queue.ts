import { and, asc, eq, lt, lte, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema/tenant";
import type { TenantDb } from "./log";

/**
 * Cola de trabajos de agentes.
 *
 * POR QUÉ EXISTE. Vercel Cron tiene dos propiedades documentadas que obligan a
 * esto:
 *   1. No reintenta un cron que falla. Si la invocación se cae, ese trabajo se
 *      pierde — a menos que quede persistido en algún lado.
 *   2. Puede invocar el mismo cron más de una vez. Su propia documentación
 *      recomienda diseñar operaciones idempotentes.
 *
 * Esta tabla resuelve lo primero (reintentos con backoff) y la clave de
 * idempotencia lo segundo.
 */

export type Job = typeof schema.jobs.$inferSelect;

/** Espera antes de cada reintento: 1 minuto, 5 minutos, 30 minutos. */
export const BACKOFF_SEGUNDOS = [60, 300, 1800] as const;

/**
 * Un job que lleva más de esto en "ejecutando" se da por abandonado: la
 * función de Vercel se cayó a mitad. Vuelve a la cola para que otro lo tome.
 */
export const SEGUNDOS_JOB_ATASCADO = 15 * 60;

export type ResultadoEncolado = {
  /** false = ya existía un job con esa clave. No es un error: es la idempotencia funcionando. */
  creado: boolean;
  id: string | null;
};

export async function encolar(
  db: TenantDb,
  p: {
    tipo: string;
    /** SOLO ids. Nunca montos — se releen en el momento de ejecutar. */
    payload: unknown;
    idempotencyKey: string;
    ejecutarEn?: number;
    maxIntentos?: number;
    ahora: number;
  },
): Promise<ResultadoEncolado> {
  const creadas = await db
    .insert(schema.jobs)
    .values({
      id: crypto.randomUUID(),
      type: p.tipo,
      payload: JSON.stringify(p.payload ?? {}),
      status: "pendiente",
      attempts: 0,
      maxAttempts: p.maxIntentos ?? 3,
      runAfter: p.ejecutarEn ?? p.ahora,
      idempotencyKey: p.idempotencyKey,
      createdAt: p.ahora,
      updatedAt: p.ahora,
    })
    .onConflictDoNothing()
    .returning({ id: schema.jobs.id });

  if (creadas.length > 0) return { creado: true, id: creadas[0].id };

  const existente = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(eq(schema.jobs.idempotencyKey, p.idempotencyKey))
    .get();

  return { creado: false, id: existente?.id ?? null };
}

/** Devuelve a la cola los jobs abandonados por una función que se cayó. */
export async function reclamarAtascados(db: TenantDb, ahora: number): Promise<number> {
  const r = await db
    .update(schema.jobs)
    .set({ status: "pendiente", updatedAt: ahora })
    .where(and(
      eq(schema.jobs.status, "ejecutando"),
      lt(schema.jobs.updatedAt, ahora - SEGUNDOS_JOB_ATASCADO),
    ));
  return r.rowsAffected ?? 0;
}

export async function tomarPendientes(
  db: TenantDb, tipo: string, ahora: number, limite = 25,
): Promise<Job[]> {
  return db
    .select()
    .from(schema.jobs)
    .where(and(
      eq(schema.jobs.type, tipo),
      eq(schema.jobs.status, "pendiente"),
      lte(schema.jobs.runAfter, ahora),
    ))
    .orderBy(asc(schema.jobs.runAfter))
    .limit(limite);
}

/**
 * Toma el job en exclusiva. El UPDATE condicional es lo que evita que dos
 * invocaciones concurrentes del worker ejecuten el mismo job: solo una ve
 * rowsAffected === 1.
 */
export async function marcarEjecutando(db: TenantDb, jobId: string, ahora: number): Promise<boolean> {
  const r = await db
    .update(schema.jobs)
    .set({
      status: "ejecutando",
      attempts: sql`${schema.jobs.attempts} + 1`,
      updatedAt: ahora,
    })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.status, "pendiente")));
  return (r.rowsAffected ?? 0) === 1;
}

export async function marcarHecho(db: TenantDb, jobId: string, ahora: number): Promise<void> {
  await db.update(schema.jobs)
    .set({ status: "hecho", error: null, updatedAt: ahora })
    .where(eq(schema.jobs.id, jobId));
}

/** Un guardarraíl bloqueó el envío. No es un fallo: es el sistema funcionando. */
export async function cancelarJob(
  db: TenantDb, jobId: string, motivo: string, ahora: number,
): Promise<void> {
  await db.update(schema.jobs)
    .set({ status: "cancelado", error: motivo, updatedAt: ahora })
    .where(eq(schema.jobs.id, jobId));
}

export type ResultadoFallo = "reprogramado" | "fallido";

/**
 * Reprograma con backoff, o marca fallido al agotar los intentos.
 * `attempts` ya viene incrementado por marcarEjecutando.
 */
export async function registrarFalloJob(
  db: TenantDb, job: Job, error: string, ahora: number,
): Promise<ResultadoFallo> {
  const agotado = job.attempts >= job.maxAttempts;

  if (agotado) {
    await db.update(schema.jobs)
      .set({ status: "fallido", error, updatedAt: ahora })
      .where(eq(schema.jobs.id, job.id));
    return "fallido";
  }

  const espera = BACKOFF_SEGUNDOS[Math.min(job.attempts - 1, BACKOFF_SEGUNDOS.length - 1)] ?? 60;
  await db.update(schema.jobs)
    .set({ status: "pendiente", error, runAfter: ahora + espera, updatedAt: ahora })
    .where(eq(schema.jobs.id, job.id));
  return "reprogramado";
}
