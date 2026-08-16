import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolverDestinatario, type UsuarioCandidato } from "./destinatario";

const u = (o: Partial<UsuarioCandidato> & { id: string }): UsuarioCandidato => ({
  name: "Carlos Perez", role: "resident", phone: "3001112233",
  active: 1, unitIds: JSON.stringify(["u1"]), createdAt: 1000, ...o,
});

describe("resolverDestinatario", () => {
  test("le escribe al propietario cuando hay propietario y arrendatario", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "arr", role: "tenant", name: "Ana Arrendataria", phone: "3009998877" }),
      u({ id: "pro", role: "resident", name: "Carlos Propietario", phone: "3001112233" }),
    ]);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.destinatario.userId, "pro");
    assert.equal(r.ok && r.destinatario.rol, "resident");
  });

  test("cae al arrendatario solo si el propietario no tiene telefono", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "pro", role: "resident", phone: null }),
      u({ id: "arr", role: "tenant", phone: "3009998877" }),
    ]);
    assert.equal(r.ok && r.destinatario.userId, "arr");
  });

  test("NUNCA le escribe al Observador, aunque sea el unico con telefono", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "obs", role: "observer", phone: "3001112233" }),
    ]);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.motivo, "solo_observador");
  });

  test("el Observador no gana ni siendo el mas antiguo", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "obs", role: "observer", phone: "3000000000", createdAt: 1 }),
      u({ id: "pro", role: "resident", phone: "3001112233", createdAt: 999 }),
    ]);
    assert.equal(r.ok && r.destinatario.userId, "pro");
  });

  test("sin telefono en nadie: omite con motivo, no inventa destinatario", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "pro", role: "resident", phone: null }),
      u({ id: "arr", role: "tenant", phone: "   " }),
    ]);
    assert.equal(!r.ok && r.motivo, "sin_telefono");
  });

  test("un telefono demasiado corto no cuenta como telefono", () => {
    const r = resolverDestinatario("u1", [u({ id: "pro", phone: "123" })]);
    assert.equal(!r.ok && r.motivo, "sin_telefono");
  });

  test("ignora usuarios inactivos", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "viejo", active: 0, phone: "3000000000" }),
      u({ id: "actual", phone: "3001112233" }),
    ]);
    assert.equal(r.ok && r.destinatario.userId, "actual");
  });

  test("ignora usuarios de otras unidades", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "otro", unitIds: JSON.stringify(["u2"]), phone: "3000000000" }),
    ]);
    assert.equal(!r.ok && r.motivo, "sin_residentes");
  });

  test("un residente con varias unidades cuenta para todas", () => {
    const usuarios = [u({ id: "multi", unitIds: JSON.stringify(["u1", "u7"]) })];
    assert.equal(resolverDestinatario("u1", usuarios).ok, true);
    assert.equal(resolverDestinatario("u7", usuarios).ok, true);
  });

  test("unitIds corrupto no tumba la corrida — ese usuario simplemente no aplica", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "roto", unitIds: "{no es json" }),
      u({ id: "bueno" }),
    ]);
    assert.equal(r.ok && r.destinatario.userId, "bueno");
  });

  test("empate entre dos propietarios: gana el mas antiguo, de forma reproducible", () => {
    const usuarios = [
      u({ id: "b", createdAt: 2000 }),
      u({ id: "a", createdAt: 1000 }),
    ];
    assert.equal(resolverDestinatario("u1", usuarios).ok && resolverDestinatario("u1", usuarios).destinatario.userId, "a");
    // Mismo resultado con el orden de entrada invertido.
    const invertido = resolverDestinatario("u1", [...usuarios].reverse());
    assert.equal(invertido.ok && invertido.destinatario.userId, "a");
  });

  test("una unidad sin nadie registrado se omite con motivo", () => {
    assert.equal(resolverDestinatario("u1", []).ok, false);
  });

  test("admin y technician no reciben avisos de cobro", () => {
    const r = resolverDestinatario("u1", [
      u({ id: "adm", role: "admin", phone: "3000000000" }),
      u({ id: "tec", role: "technician", phone: "3000000001" }),
    ]);
    assert.equal(!r.ok && r.motivo, "sin_residentes");
  });
});
