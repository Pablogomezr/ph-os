#!/usr/bin/env node
/**
 * Aplica las migraciones de drizzle/tenant-migrations a la base de CADA
 * edificio registrado en la DB central.
 *
 * package.json declaraba "db:migrate:tenant": "tsx scripts/migrate-tenant.ts",
 * pero ese archivo nunca existió: hasta hoy las migraciones de inquilino se
 * aplicaban a mano con db:push:tenant apuntando a una base a la vez. Con un
 * solo edificio se puede vivir así; con varios, no.
 *
 * POR DEFECTO NO ESCRIBE NADA. Muestra qué haría. Para aplicar de verdad hay
 * que pasar --apply explícitamente.
 *
 * Uso:
 *   node scripts/migrate-tenant.mjs                    # simulacro, todos los edificios
 *   node scripts/migrate-tenant.mjs --slug=camacol     # simulacro, uno solo
 *   node scripts/migrate-tenant.mjs --slug=camacol --apply
 *   node scripts/migrate-tenant.mjs --apply            # todos, de verdad
 *
 * Primera vez sobre una base que ya existía (marca el historial previo sin
 * ejecutarlo, y solo entonces aplica lo nuevo):
 *   node scripts/migrate-tenant.mjs --baseline=0004_whole_freak
 *   node scripts/migrate-tenant.mjs --baseline=0004_whole_freak --apply
 *   node scripts/migrate-tenant.mjs
 *   node scripts/migrate-tenant.mjs --apply
 *
 * Requiere TURSO_CENTRAL_URL y TURSO_CENTRAL_AUTH_TOKEN (vercel env pull).
 */

import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "drizzle/tenant-migrations";
const args = process.argv.slice(2);
const APLICAR = args.includes("--apply");
const SLUG = args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
/**
 * --baseline=<tag>  Marca como aplicadas todas las migraciones hasta ese tag,
 * SIN ejecutarlas. Es para bases que ya existían antes de que hubiera registro
 * de migraciones: su esquema ya está al día, pero __migraciones está vacía y
 * sin esto el script intentaría reaplicar todo desde cero y fallaría en la
 * primera sentencia.
 */
const BASELINE = args.find((a) => a.startsWith("--baseline="))?.split("=")[1] ?? null;

// ─── .env.local ──────────────────────────────────────────────────────────────
try {
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    // Las variables marcadas Sensitive en Vercel se descargan con el nombre y el
    // valor VACÍO. Tratarlas como presentes hace que el fallo aparezca después,
    // como un error de conexión incomprensible.
    if (valor && !process.env[m[1]]) process.env[m[1]] = valor;
  }
} catch { /* sin .env.local */ }

if (!process.env.TURSO_CENTRAL_URL || !process.env.TURSO_CENTRAL_AUTH_TOKEN) {
  console.error(`
No hay credenciales de la base central: faltan TURSO_CENTRAL_URL y/o
TURSO_CENTRAL_AUTH_TOKEN, o llegaron vacías.

Si ya corriste  vercel env pull .env.local --environment=production  y aun así
faltan, es porque en Vercel están marcadas como Sensitive: el valor no se puede
volver a leer, ni desde la CLI ni desde el panel. Hay dos caminos:

  a) Desde Turso, que es la fuente de verdad:
       turso db list
       turso db show <base-central> --url
       turso db tokens create <base-central>

  b) Desde un proyecto de Vercel donde NO estén marcadas Sensitive
     (revisa el ojito en Settings → Environment Variables).

Y las pegas a mano en .env.local:
  TURSO_CENTRAL_URL=libsql://...
  TURSO_CENTRAL_AUTH_TOKEN=...

El simulacro te dirá enseguida si acertaste: lista los edificios por nombre.
`);
  process.exit(1);
}

// ─── Migraciones en disco, en orden ──────────────────────────────────────────
const migraciones = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ nombre: f, sql: readFileSync(join(DIR, f), "utf8") }));

if (migraciones.length === 0) {
  console.error(`No hay migraciones en ${DIR}`);
  process.exit(1);
}

// ─── Edificios ───────────────────────────────────────────────────────────────
const central = createClient({
  url: process.env.TURSO_CENTRAL_URL,
  authToken: process.env.TURSO_CENTRAL_AUTH_TOKEN,
});

const { rows: edificios } = await central.execute({
  sql: "SELECT slug, name, turso_db_url, turso_auth_token, status FROM buildings"
     + (SLUG ? " WHERE slug = ?" : ""),
  args: SLUG ? [SLUG] : [],
});

if (edificios.length === 0) {
  console.error(SLUG ? `No existe el edificio "${SLUG}"` : "No hay edificios registrados");
  process.exit(1);
}

console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (sin --apply no se escribe nada)"}`);
console.log(`${migraciones.length} migración(es) · ${edificios.length} edificio(s)\n`);

let errores = 0;

for (const e of edificios) {
  if (e.status === "suspended") {
    console.log(`  ⊘ ${e.slug} — suspendido, se omite`);
    continue;
  }

  const db = createClient({ url: e.turso_db_url, authToken: e.turso_auth_token });

  // Registro de migraciones aplicadas, propio de este script.
  await db.execute(
    "CREATE TABLE IF NOT EXISTS __migraciones (nombre text PRIMARY KEY, aplicada_en integer NOT NULL)"
  );
  const { rows: yaAplicadas } = await db.execute("SELECT nombre FROM __migraciones");
  const aplicadas = new Set(yaAplicadas.map((r) => r.nombre));

  // ── Baseline ────────────────────────────────────────────────────────────
  if (BASELINE) {
    // Guarda: no marcar como aplicada la historia de una base vacía.
    const { rows: tablas } = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('units','charges')"
    );
    if (tablas.length < 2) {
      console.error(`  ✗ ${e.slug} — la base no tiene units/charges: NO parece una base ya migrada. Se omite el baseline.`);
      errores++;
      db.close();
      continue;
    }

    const corte = migraciones.findIndex((m) => m.nombre.startsWith(BASELINE));
    if (corte === -1) {
      console.error(`  ✗ ${e.slug} — no existe una migración que empiece por "${BASELINE}"`);
      errores++;
      db.close();
      continue;
    }

    const aMarcar = migraciones.slice(0, corte + 1).filter((m) => !aplicadas.has(m.nombre));
    if (aMarcar.length === 0) {
      console.log(`  ✓ ${e.slug} — el baseline ya estaba puesto`);
      db.close();
      continue;
    }

    console.log(`  ${e.slug} (${e.name}) — marcaría ${aMarcar.length} migración(es) como aplicadas SIN ejecutarlas:`);
    for (const m of aMarcar) {
      console.log(`      · ${m.nombre}`);
      if (APLICAR) {
        await db.execute({
          sql: "INSERT INTO __migraciones (nombre, aplicada_en) VALUES (?, ?)",
          args: [m.nombre, Math.floor(Date.now() / 1000)],
        });
      }
    }
    if (APLICAR) console.log(`      ✓ baseline registrado`);
    db.close();
    continue;
  }

  const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre));

  if (pendientes.length === 0) {
    console.log(`  ✓ ${e.slug} — al día`);
    db.close();
    continue;
  }

  console.log(`  ${e.slug} (${e.name}) — ${pendientes.length} pendiente(s):`);

  for (const m of pendientes) {
    // drizzle separa las sentencias con este marcador.
    const sentencias = m.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")));

    if (!APLICAR) {
      console.log(`      · ${m.nombre} — ${sentencias.length} sentencia(s)`);
      continue;
    }

    try {
      await db.batch(sentencias, "write");
      await db.execute({
        sql: "INSERT INTO __migraciones (nombre, aplicada_en) VALUES (?, ?)",
        args: [m.nombre, Math.floor(Date.now() / 1000)],
      });
      console.log(`      ✓ ${m.nombre}`);
    } catch (err) {
      errores++;
      console.error(`      ✗ ${m.nombre} — ${err.message}`);
      break; // no seguir con las siguientes de este edificio
    }
  }

  db.close();
}

central.close();

if (!APLICAR) {
  console.log("\nEsto fue un simulacro. Para aplicar de verdad, repite con --apply\n");
}

process.exit(errores === 0 ? 0 : 1);
