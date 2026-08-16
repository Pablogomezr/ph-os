import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema/tenant";
import { registrarEnBitacora, type TenantDb } from "../shared/log";
import { cancelarJob, marcarHecho, registrarFalloJob, type Job } from "../shared/queue";
import { saldoDeUnidad, UMBRAL_MINIMO_COP } from "@/lib/cartera/saldo";
import { resolverDestinatario, type UsuarioCandidato } from "./destinatario";
import { NOMBRE_PLANTILLA, IDIOMA_PLANTILLA, variablesDeAviso, esTipoAviso, type TipoAviso } from "./plantillas";
import { AGENTE } from "./encolar";

/**
 * Paso 2 del agente: los guardarraíles y el envío.
 *
 * ─── EL PROBLEMA DIFÍCIL, Y CÓMO SE RESUELVE ─────────────────────────────────
 *
 * La especificación pide dos cosas que se contradicen: que un fallo de la API
 * de WhatsApp se reintente con backoff, y que jamás salga un aviso duplicado.
 *
 * Si se registra el aviso DESPUÉS de enviar, una caída entre el envío y el
 * registro hace que el reintento mande el mensaje dos veces. Si se registra
 * ANTES y se deja la fila puesta, ningún reintento puede volver a intentarlo.
 *
 * La salida está en distinguir un fallo CONOCIDO de un silencio:
 *
 *   1. Se RESERVA la fila antes de enviar, marcada con el id de este job.
 *   2. Si el envío falla y Meta nos devuelve el error, se guarda ese error en
 *      la fila. El reintento ve "reservado + hay error + es mi propio job" y
 *      reenvía con tranquilidad: sabemos que el mensaje no salió.
 *   3. Si el proceso se cae y nunca sabemos qué pasó, la fila queda
 *      "reservado" SIN error. El reintento ve eso y NO reenvía: no sabemos si
 *      el mensaje salió, y ante la duda no se cobra dos veces. Se registra y
 *      se alerta al administrador para que lo revise a mano.
 *   4. Una fila reservada por OTRO job (un cron duplicado, un despliegue
 *      zombi) nunca se toca.
 *
 * Un cobro duplicado destruye más confianza que un cobro tardío, así que en el
 * único caso ambiguo el sistema se calla y avisa.
 */

export type EnvioPlantilla = (p: {
  to: string;
  plantilla: string;
  idioma: string;
  variables: string[];
}) => Promise<{ waMessageId: string | null }>;

export type DepsEjecucion = {
  enviar: EnvioPlantilla;
  ahora: number;
  umbral?: number;
  /**
   * Punto de extensión. Los acuerdos de pago quedan fuera de esta rebanada
   * (§1) pero el guardarraíl sí está en §7 — contradicción de la propia
   * especificación. Cuando exista la tabla acuerdos_pago, esto la consulta.
   */
  tieneAcuerdoVigente?: (unidadId: string) => Promise<boolean>;
};

export type ResultadoEjecucion =
  | { estado: "enviado"; waMessageId: string | null; saldo: number }
  | { estado: "omitido"; motivo: string }
  | { estado: "reintentar"; error: string }
  | { estado: "revisar"; motivo: string };

type Payload = { unidadId: string; tipoAviso: number; periodo: string };

function leerPayload(job: Job): Payload | null {
  try {
    const p = JSON.parse(job.payload) as Partial<Payload>;
    if (typeof p.unidadId !== "string" || typeof p.periodo !== "string" || !esTipoAviso(p.tipoAviso)) {
      return null;
    }
    return { unidadId: p.unidadId, tipoAviso: p.tipoAviso, periodo: p.periodo };
  } catch {
    return null;
  }
}

/** Estados en los que el aviso ya salió y no se vuelve a tocar. */
const YA_SALIO = new Set(["enviado", "entregado", "leido"]);

export async function ejecutarJobAviso(
  db: TenantDb, job: Job, deps: DepsEjecucion,
): Promise<ResultadoEjecucion> {
  const { ahora } = deps;
  const umbral = deps.umbral ?? UMBRAL_MINIMO_COP;

  const payload = leerPayload(job);
  if (!payload) return { estado: "omitido", motivo: "payload_invalido" };

  const { unidadId, periodo } = payload;
  const tipo = payload.tipoAviso as TipoAviso;

  const registrar = (
    resultado: "ok" | "omitido" | "error",
    nivel: "verde" | "amarillo" | "rojo",
    motivo: string | null,
    salida: unknown,
  ) => registrarEnBitacora(db, {
    agente: AGENTE, accion: `aviso_${tipo}`, nivel, unidadId,
    entrada: { periodo, tipo, jobId: job.id, intento: job.attempts },
    salida, resultado, motivo, ahora,
  });

  // ── GUARDARRAÍL 1: el saldo se relee de la base AHORA MISMO ────────────────
  // Nunca desde el payload. Si pagó entre encolar y enviar, el aviso no sale.
  const [cargos, pagos, unidad, usuarios] = await Promise.all([
    db.select({
      id: schema.charges.id, unitId: schema.charges.unitId, amount: schema.charges.amount,
      dueDate: schema.charges.dueDate, status: schema.charges.status,
    }).from(schema.charges).where(eq(schema.charges.unitId, unidadId)),
    db.select({ chargeId: schema.payments.chargeId, amount: schema.payments.amount })
      .from(schema.payments).where(eq(schema.payments.unitId, unidadId)),
    db.select({ id: schema.units.id, number: schema.units.number })
      .from(schema.units).where(eq(schema.units.id, unidadId)).get(),
    db.select().from(schema.users),
  ]);

  if (!unidad) {
    await registrar("omitido", "verde", "unidad_inexistente", {});
    return { estado: "omitido", motivo: "unidad_inexistente" };
  }

  const saldo = saldoDeUnidad(unidadId, cargos, pagos, ahora).saldoVencido;

  // ── GUARDARRAÍL 2: saldo en cero o por debajo del umbral ───────────────────
  if (saldo < umbral) {
    const motivo = saldo === 0 ? "saldo_cero" : "saldo_bajo_umbral";
    await registrar("omitido", "verde", motivo, { saldo });
    return { estado: "omitido", motivo };
  }

  // ── GUARDARRAÍL 3: acuerdo de pago vigente y al día ────────────────────────
  if (deps.tieneAcuerdoVigente && (await deps.tieneAcuerdoVigente(unidadId))) {
    await registrar("omitido", "verde", "acuerdo_vigente", { saldo });
    return { estado: "omitido", motivo: "acuerdo_vigente" };
  }

  // ── GUARDARRAÍL 4: destinatario válido, nunca el Observador ────────────────
  const destino = resolverDestinatario(unidadId, usuarios as unknown as UsuarioCandidato[]);
  if (!destino.ok) {
    await registrar("omitido", "verde", destino.motivo, { saldo });
    return { estado: "omitido", motivo: destino.motivo };
  }

  // ── RESERVA (ver el comentario de cabecera) ────────────────────────────────
  const reservadas = await db.insert(schema.carteraNotices).values({
    id: crypto.randomUUID(),
    unitId: unidadId,
    period: periodo,
    noticeType: tipo,
    balanceAtSend: saldo,
    jobId: job.id,
    recipientUserId: destino.destinatario.userId,
    recipientPhone: destino.destinatario.telefono,
    status: "reservado",
    createdAt: ahora,
  }).onConflictDoNothing().returning({ id: schema.carteraNotices.id });

  let avisoId: string;

  if (reservadas.length > 0) {
    avisoId = reservadas[0].id;
  } else {
    const existente = await db.select().from(schema.carteraNotices).where(and(
      eq(schema.carteraNotices.unitId, unidadId),
      eq(schema.carteraNotices.period, periodo),
      eq(schema.carteraNotices.noticeType, tipo),
    )).get();

    if (!existente) {
      // No debería pasar: el insert chocó pero la fila no está.
      return { estado: "reintentar", error: "reserva_inconsistente" };
    }

    if (YA_SALIO.has(existente.status)) {
      await registrar("omitido", "verde", "ya_enviado", { avisoId: existente.id });
      return { estado: "omitido", motivo: "ya_enviado" };
    }

    if (existente.status === "fallido") {
      await registrar("omitido", "amarillo", "envio_fallido_previamente", { avisoId: existente.id });
      return { estado: "omitido", motivo: "envio_fallido_previamente" };
    }

    const esMiPropioReintento = existente.jobId === job.id;
    const huboFalloConocido = Boolean(existente.error);

    if (!esMiPropioReintento) {
      // Otra ejecución reservó esto. Puede ser un cron duplicado o un segundo
      // proyecto desplegando el mismo repositorio. No se toca.
      await registrar("omitido", "amarillo", "reservado_por_otra_ejecucion",
        { avisoId: existente.id, jobIdDeLaReserva: existente.jobId });
      return { estado: "omitido", motivo: "reservado_por_otra_ejecucion" };
    }

    if (!huboFalloConocido) {
      // Mi propio job reservó y nunca supimos qué pasó: el proceso se cayó
      // entre el envío y el registro. No sabemos si el mensaje salió, así que
      // no se reenvía. Queda para revisión humana.
      await db.update(schema.carteraNotices)
        .set({ status: "revisar", error: "reserva sin confirmar — el proceso se cayó durante el envío" })
        .where(eq(schema.carteraNotices.id, existente.id));
      await registrar("error", "rojo", "reserva_sin_confirmar", { avisoId: existente.id });
      return { estado: "revisar", motivo: "reserva_sin_confirmar" };
    }

    // Fallo conocido en mi propio intento anterior: el mensaje no salió.
    avisoId = existente.id;
    await db.update(schema.carteraNotices)
      .set({ balanceAtSend: saldo, recipientPhone: destino.destinatario.telefono, error: null })
      .where(eq(schema.carteraNotices.id, avisoId));
  }

  // ── ENVÍO ──────────────────────────────────────────────────────────────────
  try {
    const { waMessageId } = await deps.enviar({
      to: destino.destinatario.telefono,
      plantilla: NOMBRE_PLANTILLA[tipo],
      idioma: IDIOMA_PLANTILLA,
      variables: variablesDeAviso(tipo, {
        nombre: destino.destinatario.nombre,
        unidad: unidad.number,
        saldo,
        ahora,
      }),
    });

    await db.update(schema.carteraNotices)
      .set({ status: "enviado", waMessageId, sentAt: ahora, error: null })
      .where(eq(schema.carteraNotices.id, avisoId));

    await registrar("ok", "verde", null, {
      saldo, waMessageId, destinatario: destino.destinatario.userId,
      rol: destino.destinatario.rol, plantilla: NOMBRE_PLANTILLA[tipo],
    });

    return { estado: "enviado", waMessageId, saldo };
  } catch (err) {
    // Fallo CONOCIDO: Meta nos respondió con un error. Se deja anotado en la
    // fila para que el reintento sepa que puede reenviar sin duplicar.
    const mensaje = err instanceof Error ? err.message : String(err);
    await db.update(schema.carteraNotices)
      .set({ error: mensaje })
      .where(eq(schema.carteraNotices.id, avisoId));
    await registrar("error", "amarillo", "fallo_envio", { saldo, error: mensaje });
    return { estado: "reintentar", error: mensaje };
  }
}

/** Cierra la fila del aviso cuando el job agota sus reintentos. */
export async function marcarAvisoFallido(
  db: TenantDb, jobId: string, error: string,
): Promise<void> {
  await db.update(schema.carteraNotices)
    .set({ status: "fallido", error })
    .where(and(
      eq(schema.carteraNotices.jobId, jobId),
      eq(schema.carteraNotices.status, "reservado"),
    ));
}

/**
 * Procesa un job completo: lo ejecuta y actualiza la cola según el resultado.
 */
export async function procesarJobAviso(
  db: TenantDb, job: Job, deps: DepsEjecucion,
): Promise<ResultadoEjecucion> {
  const r = await ejecutarJobAviso(db, job, deps);

  if (r.estado === "enviado") {
    await marcarHecho(db, job.id, deps.ahora);
  } else if (r.estado === "omitido" || r.estado === "revisar") {
    await cancelarJob(db, job.id, r.motivo, deps.ahora);
  } else {
    const desenlace = await registrarFalloJob(db, job, r.error, deps.ahora);
    if (desenlace === "fallido") await marcarAvisoFallido(db, job.id, r.error);
  }

  return r;
}
