import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAccesoPanel, seccionesPermitidas, SECCIONES, type Seccion } from "./acceso";

const SUPER = "user_super";
const decidir = (
  userId: string | null,
  miembro: { role: string; active: number } | null,
  superadminId: string | undefined = SUPER,
  seccion?: Seccion,
) => decidirAccesoPanel({ userId, superadminId, miembro, seccion });

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

test("el técnico solo usa mantenimiento y energía", () => {
  const tecnico = { role: "technician", active: 1 };
  assert.equal(decidir("u1", tecnico, SUPER, "mantenimiento").permitido, true);
  assert.equal(decidir("u1", tecnico, SUPER, "energia").permitido, true);
  for (const s of ["dashboard", "finanzas", "residentes", "unidades", "contabilidad", "billing", "whatsapp", "mensajeria", "pqrs", "operadores"] as const) {
    assert.deepEqual(decidir("u1", tecnico, SUPER, s), { permitido: false, motivo: "seccion-restringida" }, s);
  }
});

test("el admin y el superadmin usan todas las secciones", () => {
  for (const s of SECCIONES) {
    assert.equal(decidir("u1", { role: "admin", active: 1 }, SUPER, s).permitido, true, s);
    assert.equal(decidir(SUPER, null, SUPER, s).permitido, true, s);
  }
});

test("la sección no le abre la puerta a quien no es personal del edificio", () => {
  assert.equal(decidir("admin_de_otro", null, SUPER, "mantenimiento").permitido, false);
  assert.equal(decidir("u1", { role: "resident", active: 1 }, SUPER, "mantenimiento").permitido, false);
});

test("seccionesPermitidas: lo que ve cada rol en el menú", () => {
  assert.deepEqual(seccionesPermitidas(null), SECCIONES);
  assert.deepEqual(seccionesPermitidas("admin"), SECCIONES);
  assert.deepEqual(seccionesPermitidas("technician"), ["mantenimiento", "energia"]);
  assert.deepEqual(seccionesPermitidas("resident"), []);
});

test("un rol desconocido no entra", () => {
  assert.equal(decidir("u1", { role: "superadmin", active: 1 }).permitido, false);
  assert.equal(decidir("u1", { role: "", active: 1 }).permitido, false);
});
