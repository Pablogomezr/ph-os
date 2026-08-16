import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { autorizacionCronValida } from "./cron-auth";

const SECRETO = "un-secreto-de-al-menos-16-caracteres";

describe("autorizacionCronValida", () => {
  test("acepta la cabecera que manda Vercel", () => {
    assert.equal(autorizacionCronValida(`Bearer ${SECRETO}`, SECRETO), true);
  });

  test("rechaza otro secreto", () => {
    assert.equal(autorizacionCronValida("Bearer otro-secreto-cualquiera", SECRETO), false);
  });

  test("rechaza el secreto correcto sin el prefijo Bearer", () => {
    assert.equal(autorizacionCronValida(SECRETO, SECRETO), false);
  });

  test("rechaza cabecera ausente o vacia", () => {
    assert.equal(autorizacionCronValida(null, SECRETO), false);
    assert.equal(autorizacionCronValida(undefined, SECRETO), false);
    assert.equal(autorizacionCronValida("", SECRETO), false);
  });

  test("falla cerrado si CRON_SECRET no esta configurado", () => {
    assert.equal(autorizacionCronValida(`Bearer ${SECRETO}`, undefined), false);
    assert.equal(autorizacionCronValida("Bearer ", ""), false);
  });

  test("rechaza un prefijo del secreto correcto", () => {
    assert.equal(autorizacionCronValida(`Bearer ${SECRETO.slice(0, -1)}`, SECRETO), false);
  });

  test("es sensible a mayusculas", () => {
    assert.equal(autorizacionCronValida(`bearer ${SECRETO}`, SECRETO), false);
  });
});
