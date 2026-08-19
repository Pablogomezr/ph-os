import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  variablesDeAviso, NOMBRE_PLANTILLA, primerNombre, formatearFecha,
  periodoDe, esTipoAviso, DIAS_PLAZO_PREJURIDICO, IDIOMA_PLANTILLA,
} from "./plantillas";

// 15 de agosto de 2026, 13:00 UTC = 8:00 a.m. en Colombia
const AHORA = Math.floor(Date.UTC(2026, 7, 15, 13, 0, 0) / 1000);

describe("plantillas de aviso", () => {
  test("el idioma coincide EXACTAMENTE con lo aprobado en Meta", () => {
    // Las plantillas quedaron aprobadas como Espanol (COL). Si esto no coincide
    // con el codigo de Meta, cada envio se rechaza — y el fallo aparece recien
    // el dia 6, cuando corre el cron.
    assert.equal(IDIOMA_PLANTILLA, "es_CO");
  });

  test("cada tipo apunta a la plantilla aprobada por Meta", () => {
    assert.equal(NOMBRE_PLANTILLA[1], "recordatorio_cuota_pendiente");
    assert.equal(NOMBRE_PLANTILLA[2], "aviso_saldo_vencido");
    assert.equal(NOMBRE_PLANTILLA[3], "preaviso_cobro_prejuridico");
  });

  test("el aviso del dia 6 lleva tres variables", () => {
    const v = variablesDeAviso(1, { nombre: "Carlos Perez", unidad: "Apto 501", saldo: 450_000, ahora: AHORA });
    assert.equal(v.length, 3);
    assert.equal(v[0], "Carlos");
    assert.equal(v[1], "Apto 501");
    assert.ok(v[2].includes("450"));
  });

  test("el aviso del dia 16 agrega la fecha de corte", () => {
    const v = variablesDeAviso(2, { nombre: "Carlos", unidad: "Apto 501", saldo: 450_000, ahora: AHORA });
    assert.equal(v.length, 4);
    assert.equal(v[3], "15 de agosto de 2026");
  });

  test("el preaviso del dia 26 agrega la fecha limite, no la de hoy", () => {
    const v = variablesDeAviso(3, { nombre: "Carlos", unidad: "Apto 501", saldo: 450_000, ahora: AHORA });
    assert.equal(v.length, 4);
    assert.equal(v[3], "25 de agosto de 2026");   // 15 + 10 dias
    assert.equal(DIAS_PLAZO_PREJURIDICO, 10);
  });

  test("usa solo el primer nombre", () => {
    assert.equal(primerNombre("  Carlos Andres Perez Gomez "), "Carlos");
    assert.equal(primerNombre("Ana"), "Ana");
  });

  test("las fechas van en hora de Colombia, no en UTC", () => {
    // 16 de agosto 02:00 UTC son todavia las 21:00 del 15 en Barranquilla.
    const casiMedianoche = Math.floor(Date.UTC(2026, 7, 16, 2, 0, 0) / 1000);
    assert.equal(formatearFecha(casiMedianoche), "15 de agosto de 2026");
  });

  test("el periodo tambien se calcula en hora de Colombia", () => {
    // 1 de septiembre 02:00 UTC = 31 de agosto en Colombia: periodo 2026-08.
    const cambioDeMes = Math.floor(Date.UTC(2026, 8, 1, 2, 0, 0) / 1000);
    assert.equal(periodoDe(cambioDeMes), "2026-08");
    assert.equal(periodoDe(AHORA), "2026-08");
  });

  test("esTipoAviso rechaza cualquier cosa que no sea 1, 2 o 3", () => {
    assert.equal(esTipoAviso(1), true);
    assert.equal(esTipoAviso(3), true);
    assert.equal(esTipoAviso(4), false);
    assert.equal(esTipoAviso("2"), false);
    assert.equal(esTipoAviso(null), false);
  });
});
