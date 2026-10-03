import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAccesoPanel } from "./acceso";

const SUPER = "user_super";
const decidir = (userId: string | null, miembro: { role: string; active: number } | null, superadminId: string | undefined = SUPER) =>
  decidirAccesoPanel({ userId, superadminId, miembro });

test("sin sesión no entra", () => {
  assert.deepEqual(decidir(null, { role: "admin", active: 1 }), { permitido: false, motivo: "sin-sesion" });
});

test("el superadmin entra aunque no esté en la tabla del edificio", () => {
  assert.equal(decidir(SUPER, null).permitido, true);
});

test("SUPERADMIN_USER_ID vacío o ausente no le da acceso a nadie", () => {
  assert.equal(decidir("", null, "").permitido, false);
  assert.equal(decidir("user_x", null, undefined).permitido, false);
});

test("admin y technician activos del edificio entran", () => {
  assert.equal(decidir("u1", { role: "admin", active: 1 }).permitido, true);
  assert.equal(decidir("u1", { role: "technician", active: 1 }).permitido, true);
});

test("un usuario que no está en la tabla de ESTE edificio no entra (admin de otro edificio)", () => {
  assert.deepEqual(decidir("admin_de_otro", null), { permitido: false, motivo: "no-miembro" });
});

test("personal inactivo no entra", () => {
  assert.deepEqual(decidir("u1", { role: "admin", active: 0 }), { permitido: false, motivo: "inactivo" });
});

test("propietario, arrendatario y observador van a su portal", () => {
  for (const role of ["resident", "tenant", "observer"]) {
    assert.deepEqual(decidir("u1", { role, active: 1 }), { permitido: false, motivo: "portal-residente" });
  }
});

test("el operario va a su portal", () => {
  assert.deepEqual(decidir("u1", { role: "operator", active: 1 }), { permitido: false, motivo: "portal-operario" });
});

test("un rol desconocido no entra", () => {
  assert.equal(decidir("u1", { role: "superadmin", active: 1 }).permitido, false);
  assert.equal(decidir("u1", { role: "", active: 1 }).permitido, false);
});
