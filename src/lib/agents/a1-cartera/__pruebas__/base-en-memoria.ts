import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema/tenant";
import type { TenantDb } from "../../shared/log";

/**
 * Base libSQL en memoria con el esquema real del inquilino.
 *
 * No es un simulacro: es SQLite de verdad, con los mismos índices únicos que
 * corren en producción. Es la única forma de verificar la idempotencia — un
 * mock siempre "cumpliría" la restricción que uno mismo programó.
 */
export type BasePrueba = { db: TenantDb; client: ReturnType<typeof createClient> };

export function crearBaseEnMemoria(): BasePrueba {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema }) as unknown as TenantDb;
  return { db, client };
}

const DDL = [
  `CREATE TABLE units (
     id text PRIMARY KEY NOT NULL, number text NOT NULL, type text NOT NULL DEFAULT 'apartment',
     floor integer, area_m2 real, coefficient real NOT NULL DEFAULT 0,
     cost_center text, business_name text, owner_id text, resident_id text,
     status text NOT NULL DEFAULT 'occupied', parking_spots text NOT NULL DEFAULT '[]', notes text,
     created_at integer NOT NULL DEFAULT (unixepoch()), updated_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE TABLE users (
     id text PRIMARY KEY NOT NULL, email text NOT NULL UNIQUE, name text NOT NULL,
     role text NOT NULL DEFAULT 'resident', unit_ids text NOT NULL DEFAULT '[]', phone text,
     active integer NOT NULL DEFAULT 1,
     created_at integer NOT NULL DEFAULT (unixepoch()), updated_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE TABLE charges (
     id text PRIMARY KEY NOT NULL, unit_id text NOT NULL, concept text NOT NULL DEFAULT 'ordinary',
     specific_concept text, description text, reference text, amount real NOT NULL,
     due_date integer NOT NULL, status text NOT NULL DEFAULT 'pending',
     period_start integer, period_end integer, is_mass integer NOT NULL DEFAULT 0, batch_id text,
     created_by text NOT NULL DEFAULT 'test',
     created_at integer NOT NULL DEFAULT (unixepoch()), updated_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE TABLE payments (
     id text PRIMARY KEY NOT NULL, charge_id text NOT NULL, unit_id text NOT NULL, amount real NOT NULL,
     payment_date integer NOT NULL, method text NOT NULL DEFAULT 'transfer', reference text,
     receipt_url text, notes text, bank_status text NOT NULL DEFAULT 'unverified',
     matched_movement_id text, reported_by_user_id text, reported_by_phone text,
     created_by text NOT NULL DEFAULT 'test', created_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE TABLE bank_movements (
     id text PRIMARY KEY NOT NULL, date integer NOT NULL, amount real NOT NULL,
     reference text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
     created_at integer NOT NULL DEFAULT (unixepoch()))`,

  // ── Las tres de A1, idénticas a scripts/a1-migracion-esperada.sql ──────────
  `CREATE TABLE jobs (
     id text PRIMARY KEY NOT NULL, type text NOT NULL, payload text NOT NULL DEFAULT '{}',
     status text NOT NULL DEFAULT 'pendiente', attempts integer NOT NULL DEFAULT 0,
     max_attempts integer NOT NULL DEFAULT 3, run_after integer NOT NULL,
     idempotency_key text NOT NULL, error text,
     created_at integer NOT NULL DEFAULT (unixepoch()), updated_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE UNIQUE INDEX jobs_idempotency_key_unique ON jobs (idempotency_key)`,
  `CREATE INDEX jobs_status_run_after ON jobs (status, run_after)`,
  `CREATE TABLE agent_log (
     id text PRIMARY KEY NOT NULL, agent text NOT NULL, action text NOT NULL, level text NOT NULL,
     unit_id text, input text NOT NULL DEFAULT '{}', output text NOT NULL DEFAULT '{}',
     result text NOT NULL, reason text, approved_by text,
     created_at integer NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX agent_log_agent_created ON agent_log (agent, created_at)`,
  `CREATE TABLE cartera_notices (
     id text PRIMARY KEY NOT NULL, unit_id text NOT NULL, period text NOT NULL,
     notice_type integer NOT NULL, balance_at_send integer NOT NULL, job_id text,
     recipient_user_id text, recipient_phone text, wa_message_id text,
     status text NOT NULL DEFAULT 'reservado', error text, sent_at integer,
     created_at integer NOT NULL DEFAULT (unixepoch()),
     FOREIGN KEY (unit_id) REFERENCES units(id))`,
  `CREATE UNIQUE INDEX cartera_notices_unit_period_type ON cartera_notices (unit_id, period, notice_type)`,
];

export async function crearEsquema(client: BasePrueba["client"]): Promise<void> {
  for (const sentencia of DDL) await client.execute(sentencia);
}

/** Base lista para usar: cliente, drizzle y esquema creado. */
export async function baseLista(): Promise<BasePrueba> {
  const b = crearBaseEnMemoria();
  await crearEsquema(b.client);
  return b;
}
