import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyMetaSignature, signBodyLikeMeta } from "./signature";

const SECRET = "app-secret-de-prueba";
const BODY = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ value: { metadata: { phone_number_id: "123" }, messages: [{ from: "573001112233", type: "text", text: { body: "hola" } }] } }] }],
});

describe("verifyMetaSignature", () => {
  test("acepta una firma válida generada con el App Secret correcto", () => {
    const header = signBodyLikeMeta(BODY, SECRET);
    assert.equal(verifyMetaSignature(BODY, header, SECRET), true);
  });

  test("acepta el mismo cuerpo leído como bytes crudos (Buffer)", () => {
    const raw = Buffer.from(BODY, "utf8");
    assert.equal(verifyMetaSignature(raw, signBodyLikeMeta(raw, SECRET), SECRET), true);
  });

  test("rechaza una firma calculada con otro App Secret", () => {
    const header = signBodyLikeMeta(BODY, "secreto-del-atacante");
    assert.equal(verifyMetaSignature(BODY, header, SECRET), false);
  });

  test("rechaza si el cuerpo fue alterado después de firmar — un byte basta", () => {
    const header = signBodyLikeMeta(BODY, SECRET);
    const alterado = BODY.replace("573001112233", "573009998877");
    assert.notEqual(alterado, BODY);
    assert.equal(verifyMetaSignature(alterado, header, SECRET), false);
  });

  test("rechaza si el cuerpo se re-serializa (JSON.parse + stringify cambia los bytes)", () => {
    const conEspacios = JSON.stringify(JSON.parse(BODY), null, 2);
    const header = signBodyLikeMeta(BODY, SECRET);
    assert.equal(verifyMetaSignature(conEspacios, header, SECRET), false);
  });

  test("rechaza cuando la cabecera está ausente", () => {
    assert.equal(verifyMetaSignature(BODY, null, SECRET), false);
    assert.equal(verifyMetaSignature(BODY, undefined, SECRET), false);
    assert.equal(verifyMetaSignature(BODY, "", SECRET), false);
  });

  test("rechaza cuando falta el prefijo sha256=", () => {
    const hex = createHmac("sha256", SECRET).update(BODY).digest("hex");
    assert.equal(verifyMetaSignature(BODY, hex, SECRET), false);
    assert.equal(verifyMetaSignature(BODY, `sha1=${hex}`, SECRET), false);
  });

  test("rechaza una firma que no es hex de 64 caracteres", () => {
    assert.equal(verifyMetaSignature(BODY, "sha256=deadbeef", SECRET), false);
    assert.equal(verifyMetaSignature(BODY, "sha256=" + "z".repeat(64), SECRET), false);
  });

  test("falla cerrado si el App Secret no está configurado", () => {
    const header = signBodyLikeMeta(BODY, SECRET);
    assert.equal(verifyMetaSignature(BODY, header, undefined), false);
    assert.equal(verifyMetaSignature(BODY, header, ""), false);
  });

  test("acepta la firma en mayúsculas — Meta la envía en minúsculas, pero el hex es case-insensitive", () => {
    const header = signBodyLikeMeta(BODY, SECRET).toUpperCase().replace("SHA256=", "sha256=");
    assert.equal(verifyMetaSignature(BODY, header, SECRET), true);
  });

  test("maneja cuerpos con acentos y emojis sin romper el hash (UTF-8)", () => {
    const cuerpo = JSON.stringify({ texto: "Apto 501 — pagué la administración ✅ ñandú" });
    const raw = Buffer.from(cuerpo, "utf8");
    assert.equal(verifyMetaSignature(raw, signBodyLikeMeta(raw, SECRET), SECRET), true);
    assert.equal(verifyMetaSignature(cuerpo, signBodyLikeMeta(raw, SECRET), SECRET), true);
  });
});
