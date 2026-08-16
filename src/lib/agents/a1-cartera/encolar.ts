import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema/tenant";
import { registrarEnBitacora, type TenantDb } from "../shared/log";
import { encolar } from "../shared/queue";
import { unidadesEnMora, UMBRAL_MINIMO_COP } from "@/lib/cartera/saldo";
import { resolverDestinatario, type UsuarioCandidato } from "./destinatario";
import { periodoDe, type TipoAviso } from "./plantillas";

export const AGENTE = "A1";
export const TIPO_JOB = "aviso_cartera";

/**
 * Si más de este porcentaje del edificio aparece en mora, la corrida NO encola
 * nada. Un pico así casi siempre significa un error de cálculo o un extracto
 * sin cargar, no una ola de morosos. Este control es lo que evita que un bug
 * le mande un aviso de cobro a todo el edificio.
 */
export const FRACCION_CIRCUIT_BREAKER = 0.40;

/**
 * Bloqueo suave: el saldo solo es correcto si el extracto está al día. Si un
 * propietario pagó el día 4 y el extracto se sube el 8, el aviso del día 6 le
 * llega a alguien que ya pagó — y eso es peor que no mandar nada.
 */
export const DIAS_MAX_SIN_EXTRACTO = 3;

export type MotivoBloqueo = "extracto_desactualizado" | "sin_extracto" | "circuit_breaker" | "sin_unidades";

export type ResumenEncolado = {
  encolados: number;
  /** Cuántas unidades se omitieron y por qué. */
  omitidos: Record<string, number>;
  yaEncolados: number;
  totalUnidades: number;
  unidadesEnMora: number;
  bloqueado: MotivoBloqueo | null;
  periodo: string;
};

function sumar(mapa: Record<string, number>, clave: string) {
  mapa[clave] = (mapa[clave] ?? 0) + 1;
}

/**
 * Paso 1 del agente: seleccionar y encolar. Es deliberadamente rápido y NO
 * envía nada — la ruta de cron tiene que responder rápido, y cada envío debe
 * ser reintentable de forma independiente.
 */
export async function encolarAvisos(
  db: TenantDb,
  opts: { tipo: TipoAviso; ahora: number; umbral?: number },
): Promise<ResumenEncolado> {
  const { tipo, ahora } = opts;
  const umbral = opts.umbral ?? UMBRAL_MINIMO_COP;
  const periodo = periodoDe(ahora);

  const resumen: ResumenEncolado = {
    encolados: 0, omitidos: {}, yaEncolados: 0,
    totalUnidades: 0, unidadesEnMora: 0, bloqueado: null, periodo,
  };

  const [unidades, cargos, pagos, usuarios, ultimoExtracto] = await Promise.all([
    db.select({ id: schema.units.id, number: schema.units.number }).from(schema.units),
    db.select({
      id: schema.charges.id, unitId: schema.charges.unitId, amount: schema.charges.amount,
      dueDate: schema.charges.dueDate, status: schema.charges.status,
    }).from(schema.charges),
    db.select({ chargeId: schema.payments.chargeId, amount: schema.payments.amount })
      .from(schema.payments),
    db.select().from(schema.users),
    db.select({ ultimo: sql<number | null>`MAX(${schema.bankMovements.createdAt})` })
      .from(schema.bankMovements).get(),
  ]);

  resumen.totalUnidades = unidades.length;

  const registrar = (
    resultado: "ok" | "omitido" | "error",
    nivel: "verde" | "amarillo" | "rojo",
    motivo: string | null,
    salida: unknown,
    unidadId: string | null = null,
  ) => registrarEnBitacora(db, {
    agente: AGENTE, accion: `encolar_aviso_${tipo}`, nivel,
    unidadId, entrada: { tipo, periodo, umbral }, salida, resultado, motivo, ahora,
  });

  if (unidades.length === 0) {
    resumen.bloqueado = "sin_unidades";
    await registrar("omitido", "verde", "sin_unidades", resumen);
    return resumen;
  }

  // ── Bloqueo suave por antigüedad del extracto ──────────────────────────────
  const ultimo = ultimoExtracto?.ultimo ?? null;
  if (ultimo === null) {
    resumen.bloqueado = "sin_extracto";
    await registrar("omitido", "rojo", "sin_extracto", resumen);
    return resumen;
  }
  const diasSinExtracto = (ahora - ultimo) / 86_400;
  if (diasSinExtracto > DIAS_MAX_SIN_EXTRACTO) {
    resumen.bloqueado = "extracto_desactualizado";
    await registrar("omitido", "rojo", "extracto_desactualizado",
      { ...resumen, diasSinExtracto: Math.floor(diasSinExtracto) });
    return resumen;
  }

  // ── Selección ──────────────────────────────────────────────────────────────
  const enMora = unidadesEnMora(cargos, pagos, ahora, umbral);
  resumen.unidadesEnMora = enMora.length;

  // ── Circuit breaker ────────────────────────────────────────────────────────
  if (enMora.length / unidades.length > FRACCION_CIRCUIT_BREAKER) {
    resumen.bloqueado = "circuit_breaker";
    await registrar("omitido", "rojo", "circuit_breaker", {
      ...resumen,
      fraccion: Number((enMora.length / unidades.length).toFixed(3)),
      limite: FRACCION_CIRCUIT_BREAKER,
    });
    return resumen;
  }

  // ── Encolado, una unidad a la vez ──────────────────────────────────────────
  const candidatos = usuarios as unknown as UsuarioCandidato[];

  for (const u of enMora) {
    // El destinatario se resuelve aquí para no crear un job que nace muerto,
    // y se VUELVE a resolver al enviar: ese es el que manda.
    const destino = resolverDestinatario(u.unitId, candidatos);
    if (!destino.ok) {
      sumar(resumen.omitidos, destino.motivo);
      await registrar("omitido", "verde", destino.motivo,
        { saldoVencido: u.saldoVencido }, u.unitId);
      continue;
    }

    const r = await encolar(db, {
      tipo: TIPO_JOB,
      // SOLO ids. El saldo se relee al ejecutar: si pagó entre encolar y
      // enviar, el aviso no sale.
      payload: { unidadId: u.unitId, tipoAviso: tipo, periodo },
      idempotencyKey: `aviso:${u.unitId}:${periodo}:${tipo}`,
      ahora,
    });

    if (r.creado) resumen.encolados++;
    else resumen.yaEncolados++;   // no es un error: es la idempotencia funcionando
  }

  await registrar("ok", "verde", null, resumen);
  return resumen;
}
