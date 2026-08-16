import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema/tenant";
import { baseLista, type BasePrueba } from "./__pruebas__/base-en-memoria";
import { encolarAvisos, TIPO_JOB, FRACCION_CIRCUIT_BREAKER } from "./encolar";
import { procesarJobAviso, ejecutarJobAviso, type EnvioPlantilla } from "./ejecutar";
import { tomarPendientes, marcarEjecutando, BACKOFF_SEGUNDOS } from "../shared/queue";
import { periodoDe } from "./plantillas";

// 16 de agosto de 2026, 13:00 UTC = 8:00 a.m. en Colombia
const AHORA = Math.floor(Date.UTC(2026, 7, 16, 13, 0, 0) / 1000);
const AYER = AHORA - 86_400;
const PERIODO = periodoDe(AHORA);

// ─── Utilidades de montaje ───────────────────────────────────────────────────

async function sembrarUnidad(b: BasePrueba, o: {
  id: string; numero?: string; saldo?: number; vence?: number;
  rolContacto?: string | null; telefono?: string | null;
}) {
  await b.db.insert(schema.units).values({
    id: o.id, number: o.numero ?? o.id, type: "apartment", coefficient: 1,
    createdAt: AHORA, updatedAt: AHORA,
  });

  if (o.saldo && o.saldo > 0) {
    await b.db.insert(schema.charges).values({
      id: `c-${o.id}`, unitId: o.id, concept: "ordinary", amount: o.saldo,
      dueDate: o.vence ?? AYER, status: "pending", createdBy: "test",
      createdAt: AHORA, updatedAt: AHORA,
    });
  }

  if (o.rolContacto !== null) {
    await b.db.insert(schema.users).values({
      id: `u-${o.id}`, email: `${o.id}@ejemplo.com`, name: "Carlos Perez",
      role: o.rolContacto ?? "resident", unitIds: JSON.stringify([o.id]),
      phone: o.telefono === undefined ? "3001112233" : o.telefono,
      active: 1, createdAt: AHORA, updatedAt: AHORA,
    });
  }
}

/** El bloqueo suave exige extracto reciente; casi todas las pruebas lo quieren al día. */
async function extractoAlDia(b: BasePrueba, cuandoAntes = 3600) {
  await b.db.insert(schema.bankMovements).values({
    id: `bm-${crypto.randomUUID()}`, date: AHORA - cuandoAntes, amount: 1,
    reference: "", description: "", createdAt: AHORA - cuandoAntes,
  });
}

function enviadorOk(registro: { enviados: number }): EnvioPlantilla {
  return async () => { registro.enviados++; return { waMessageId: `wamid.${registro.enviados}` }; };
}
const enviadorQueFalla: EnvioPlantilla = async () => {
  throw new Error("Meta rechazó el mensaje de WhatsApp (500)");
};

const contarJobs = (b: BasePrueba) => b.db.select().from(schema.jobs);
const contarAvisos = (b: BasePrueba) => b.db.select().from(schema.carteraNotices);
const bitacora = (b: BasePrueba) => b.db.select().from(schema.agentLog);

// ─────────────────────────────────────────────────────────────────────────────
describe("Criterio 1 — encolar dos veces produce exactamente un job por unidad", () => {
  test("la segunda corrida no crea nada nuevo", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    await sembrarUnidad(b, { id: "u2", saldo: 0 });
    await sembrarUnidad(b, { id: "u3", saldo: 0 });

    const r1 = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const r2 = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA + 60 });

    assert.equal(r1.encolados, 1);
    assert.equal(r2.encolados, 0);
    assert.equal(r2.yaEncolados, 1);
    assert.equal((await contarJobs(b)).length, 1);
  });

  test("la clave de idempotencia distingue tipo de aviso y periodo", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3", "u4"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    await encolarAvisos(b.db, { tipo: 2, ahora: AHORA });

    const jobs = await contarJobs(b);
    assert.equal(jobs.length, 2);
    assert.deepEqual(jobs.map((j) => j.idempotencyKey).sort(), [
      `aviso:u1:${PERIODO}:1`, `aviso:u1:${PERIODO}:2`,
    ]);
  });
});

describe("Criterio 2 — quien paga entre encolar y enviar no recibe aviso", () => {
  test("se omite con motivo saldo_cero y no se manda nada", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    // Paga DESPUÉS de encolar.
    await b.db.insert(schema.payments).values({
      id: "p1", chargeId: "c-u1", unitId: "u1", amount: 400_000,
      paymentDate: AHORA, method: "transfer", createdBy: "test", createdAt: AHORA,
    });

    const registro = { enviados: 0 };
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA + 300);
    await marcarEjecutando(b.db, job.id, AHORA + 300);
    const r = await procesarJobAviso(b.db, { ...job, attempts: 1 }, {
      enviar: enviadorOk(registro), ahora: AHORA + 300,
    });

    assert.equal(r.estado, "omitido");
    assert.equal(r.estado === "omitido" && r.motivo, "saldo_cero");
    assert.equal(registro.enviados, 0);
    assert.equal((await contarAvisos(b)).length, 0);

    const log = await bitacora(b);
    assert.ok(log.some((l) => l.reason === "saldo_cero" && l.result === "omitido"));
  });

  test("un abono parcial que deja el saldo bajo el umbral tambien lo detiene", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    await b.db.insert(schema.payments).values({
      id: "p1", chargeId: "c-u1", unitId: "u1", amount: 399_000,
      paymentDate: AHORA, method: "transfer", createdBy: "test", createdAt: AHORA,
    });

    const registro = { enviados: 0 };
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA + 300);
    const r = await procesarJobAviso(b.db, { ...job, attempts: 1 }, {
      enviar: enviadorOk(registro), ahora: AHORA + 300,
    });

    assert.equal(r.estado === "omitido" && r.motivo, "saldo_bajo_umbral");
    assert.equal(registro.enviados, 0);
  });
});

describe("Criterio 3 — al Observador no se le cobra", () => {
  test("una unidad cuyo unico contacto es Observador no genera job ni envio", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000, rolContacto: "observer" });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    assert.equal(r.encolados, 0);
    assert.equal(r.omitidos["solo_observador"], 1);
    assert.equal((await contarJobs(b)).length, 0);

    const log = await bitacora(b);
    assert.ok(log.some((l) => l.reason === "solo_observador" && l.unitId === "u1"));
  });

  test("una unidad sin telefono se omite y queda registrada", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000, telefono: null });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    assert.equal(r.omitidos["sin_telefono"], 1);
    assert.equal((await contarJobs(b)).length, 0);
  });
});

describe("Criterio 4 — circuit breaker del 40%", () => {
  test("con mas del 40% en mora no se encola NADA y se alerta", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    // 3 de 5 en mora = 60% > 40%
    for (const u of ["u1", "u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 400_000 });
    for (const u of ["u4", "u5"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    assert.equal(r.bloqueado, "circuit_breaker");
    assert.equal(r.encolados, 0);
    assert.equal((await contarJobs(b)).length, 0);

    const log = await bitacora(b);
    const alerta = log.find((l) => l.reason === "circuit_breaker");
    assert.ok(alerta, "debe quedar la alerta en la bitacora");
    assert.equal(alerta!.level, "rojo");
    assert.equal(alerta!.result, "omitido");
  });

  test("justo en el limite del 40% SI encola — el corte es estrictamente mayor", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    // 2 de 5 = 40%, no lo supera
    for (const u of ["u1", "u2"]) await sembrarUnidad(b, { id: u, saldo: 400_000 });
    for (const u of ["u3", "u4", "u5"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    assert.equal(r.bloqueado, null);
    assert.equal(r.encolados, 2);
    assert.equal(FRACCION_CIRCUIT_BREAKER, 0.40);
  });
});

describe("Criterio 5 — un fallo de la API de WhatsApp reintenta sin duplicar", () => {
  test("falla, se reprograma con backoff, y al reintentar envia UNA sola vez", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    // Intento 1: Meta responde con error.
    let [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);
    await marcarEjecutando(b.db, job.id, AHORA);
    const r1 = await procesarJobAviso(b.db, { ...job, attempts: 1 }, {
      enviar: enviadorQueFalla, ahora: AHORA,
    });
    assert.equal(r1.estado, "reintentar");

    const jobTrasFallo = (await contarJobs(b))[0];
    assert.equal(jobTrasFallo.status, "pendiente");
    assert.equal(jobTrasFallo.runAfter, AHORA + BACKOFF_SEGUNDOS[0]);

    // Todavía no se puede tomar: el backoff no ha vencido.
    assert.equal((await tomarPendientes(b.db, TIPO_JOB, AHORA + 10)).length, 0);

    // Intento 2, ya vencido el backoff: ahora sí sale.
    const luego = AHORA + BACKOFF_SEGUNDOS[0] + 1;
    [job] = await tomarPendientes(b.db, TIPO_JOB, luego);
    await marcarEjecutando(b.db, job.id, luego);
    const registro = { enviados: 0 };
    const r2 = await procesarJobAviso(b.db, { ...job, attempts: 2 }, {
      enviar: enviadorOk(registro), ahora: luego,
    });

    assert.equal(r2.estado, "enviado");
    assert.equal(registro.enviados, 1, "exactamente un envio, no dos");

    const avisos = await contarAvisos(b);
    assert.equal(avisos.length, 1, "una sola fila de aviso");
    assert.equal(avisos[0].status, "enviado");
    assert.equal(avisos[0].waMessageId, "wamid.1");
    assert.equal(avisos[0].error, null);
  });

  test("si el proceso se cayo sin saber el desenlace, NO se reenvia: queda para revision", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    // Simula la caída: la reserva quedó puesta, sin error y sin envío confirmado.
    await b.db.insert(schema.carteraNotices).values({
      id: "reserva-huerfana", unitId: "u1", period: PERIODO, noticeType: 1,
      balanceAtSend: 400_000, jobId: job.id, status: "reservado", createdAt: AHORA,
    });

    const registro = { enviados: 0 };
    const r = await ejecutarJobAviso(b.db, { ...job, attempts: 2 }, {
      enviar: enviadorOk(registro), ahora: AHORA + 300,
    });

    assert.equal(r.estado, "revisar");
    assert.equal(registro.enviados, 0, "ante la duda no se cobra dos veces");

    const aviso = (await contarAvisos(b))[0];
    assert.equal(aviso.status, "revisar");

    const log = await bitacora(b);
    const alerta = log.find((l) => l.reason === "reserva_sin_confirmar");
    assert.ok(alerta);
    assert.equal(alerta!.level, "rojo");
  });

  test("una reserva de OTRA ejecucion nunca se pisa", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    await b.db.insert(schema.carteraNotices).values({
      id: "de-otro", unitId: "u1", period: PERIODO, noticeType: 1,
      balanceAtSend: 400_000, jobId: "job-de-otro-proyecto",
      status: "reservado", error: "algo", createdAt: AHORA,
    });

    const registro = { enviados: 0 };
    const r = await ejecutarJobAviso(b.db, { ...job, attempts: 1 }, {
      enviar: enviadorOk(registro), ahora: AHORA,
    });

    assert.equal(r.estado === "omitido" && r.motivo, "reservado_por_otra_ejecucion");
    assert.equal(registro.enviados, 0);
  });

  test("al agotar los intentos el aviso queda fallido, no reservado para siempre", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    // attempts = maxAttempts: es el último intento.
    await procesarJobAviso(b.db, { ...job, attempts: 3 }, {
      enviar: enviadorQueFalla, ahora: AHORA,
    });

    assert.equal((await contarJobs(b))[0].status, "fallido");
    assert.equal((await contarAvisos(b))[0].status, "fallido");
  });
});

describe("Criterio 6 — toda ejecucion deja fila en la bitacora", () => {
  test("la corrida deja resumen, y cada omitido deja su motivo", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    await sembrarUnidad(b, { id: "u2", saldo: 400_000, rolContacto: "observer" });
    for (const u of ["u3", "u4", "u5", "u6"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const log = await bitacora(b);

    assert.ok(log.length >= 2);
    assert.ok(log.every((l) => l.agent === "A1"));
    assert.ok(log.some((l) => l.result === "ok"), "resumen de la corrida");
    assert.ok(log.some((l) => l.reason === "solo_observador"), "motivo del omitido");
  });

  test("hasta una corrida bloqueada por el extracto deja rastro", async () => {
    const b = await baseLista();
    await extractoAlDia(b, 10 * 86_400);   // extracto de hace 10 dias
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });

    assert.equal(r.bloqueado, "extracto_desactualizado");
    assert.equal((await contarJobs(b)).length, 0);
    const log = await bitacora(b);
    assert.ok(log.some((l) => l.reason === "extracto_desactualizado" && l.level === "rojo"));
  });

  test("sin extracto cargado nunca, tampoco se cobra", async () => {
    const b = await baseLista();
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });

    const r = await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    assert.equal(r.bloqueado, "sin_extracto");
    assert.equal((await contarJobs(b)).length, 0);
  });
});

describe("Criterio 7 — el monto del aviso es el mismo que ve el propietario", () => {
  test("balance_at_send coincide con el saldo vencido, restando abonos", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await b.db.insert(schema.payments).values({
      id: "p1", chargeId: "c-u1", unitId: "u1", amount: 150_000,
      paymentDate: AYER, method: "transfer", createdBy: "test", createdAt: AYER,
    });

    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    const variables: string[][] = [];
    const enviar: EnvioPlantilla = async (p) => { variables.push(p.variables); return { waMessageId: "wamid.x" }; };
    const r = await procesarJobAviso(b.db, { ...job, attempts: 1 }, { enviar, ahora: AHORA });

    assert.equal(r.estado, "enviado");
    assert.equal((await contarAvisos(b))[0].balanceAtSend, 250_000);
    // El texto del aviso lleva esa misma cifra.
    assert.ok(variables[0][2].includes("250"));
  });

  test("el envio usa plantilla aprobada, nunca texto libre", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000, numero: "Apto 501" });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 3, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    let recibido: Parameters<EnvioPlantilla>[0] | null = null;
    const enviar: EnvioPlantilla = async (p) => { recibido = p; return { waMessageId: "wamid.x" }; };
    await procesarJobAviso(b.db, { ...job, attempts: 1 }, { enviar, ahora: AHORA });

    assert.ok(recibido);
    assert.equal(recibido!.plantilla, "preaviso_cobro_prejuridico");
    assert.equal(recibido!.variables.length, 4);
    assert.equal(recibido!.variables[1], "Apto 501");
  });
});

describe("Guardarrail extra — acuerdo de pago vigente", () => {
  test("no se le cobra a quien esta cumpliendo lo pactado", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    const registro = { enviados: 0 };
    const r = await procesarJobAviso(b.db, { ...job, attempts: 1 }, {
      enviar: enviadorOk(registro), ahora: AHORA,
      tieneAcuerdoVigente: async () => true,
    });

    assert.equal(r.estado === "omitido" && r.motivo, "acuerdo_vigente");
    assert.equal(registro.enviados, 0);
  });
});

describe("Concurrencia — dos workers no ejecutan el mismo job", () => {
  test("solo uno logra marcarlo en ejecucion", async () => {
    const b = await baseLista();
    await extractoAlDia(b);
    await sembrarUnidad(b, { id: "u1", saldo: 400_000 });
    for (const u of ["u2", "u3"]) await sembrarUnidad(b, { id: u, saldo: 0 });
    await encolarAvisos(b.db, { tipo: 1, ahora: AHORA });
    const [job] = await tomarPendientes(b.db, TIPO_JOB, AHORA);

    assert.equal(await marcarEjecutando(b.db, job.id, AHORA), true);
    assert.equal(await marcarEjecutando(b.db, job.id, AHORA), false);
  });
});
