import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  saldoDeCargo, estaVencido, estadoEfectivo, saldosPorUnidad,
  saldoDeUnidad, unidadesEnMora, pagosPorCargo,
  type CargoParaSaldo, type PagoParaSaldo,
} from "./saldo";

const AHORA = 1_760_000_000;           // referencia fija
const AYER = AHORA - 86_400;
const MANANA = AHORA + 86_400;

const cargo = (o: Partial<CargoParaSaldo> & { id: string }): CargoParaSaldo => ({
  unitId: "u1", amount: 100_000, dueDate: AYER, status: "pending", ...o,
});

describe("saldoDeCargo", () => {
  test("resta los pagos aplicados", () => {
    assert.equal(saldoDeCargo(cargo({ id: "c1", amount: 100_000 }), 30_000), 70_000);
  });

  test("un cargo pagado no aporta saldo aunque no haya pagos registrados", () => {
    assert.equal(saldoDeCargo(cargo({ id: "c1", status: "paid" }), 0), 0);
  });

  test("nunca es negativo — un sobrepago no enmascara otra deuda", () => {
    assert.equal(saldoDeCargo(cargo({ id: "c1", amount: 100_000 }), 150_000), 0);
  });

  test("redondea a peso entero una sola vez, sobre la diferencia", () => {
    // 100000.4 - 30000.3 = 70000.1 -> 70000. Redondear por separado daria 70000 tambien,
    // pero este caso distingue: 0.5 - 0.4 = 0.1 -> 0, no 1 - 0 = 1.
    assert.equal(saldoDeCargo(cargo({ id: "c1", amount: 0.5 }), 0.4), 0);
  });
});

describe("estaVencido / estadoEfectivo", () => {
  test("vencido = no pagado y fecha pasada", () => {
    assert.equal(estaVencido(cargo({ id: "c1", dueDate: AYER }), AHORA), true);
    assert.equal(estaVencido(cargo({ id: "c1", dueDate: MANANA }), AHORA), false);
    assert.equal(estaVencido(cargo({ id: "c1", dueDate: AYER, status: "paid" }), AHORA), false);
  });

  test("un cargo con pago parcial y fecha pasada SI esta vencido", () => {
    // El portal del residente los ignoraba: filtraba pending y overdue por separado.
    assert.equal(estaVencido(cargo({ id: "c1", dueDate: AYER, status: "partial" }), AHORA), true);
  });

  test("estadoEfectivo deriva overdue sin leerlo de la base", () => {
    assert.equal(estadoEfectivo(cargo({ id: "c1", dueDate: AYER }), AHORA), "overdue");
    assert.equal(estadoEfectivo(cargo({ id: "c1", dueDate: MANANA }), AHORA), "pending");
    assert.equal(estadoEfectivo(cargo({ id: "c1", status: "paid" }), AHORA), "paid");
  });
});

describe("saldosPorUnidad", () => {
  const cargos: CargoParaSaldo[] = [
    cargo({ id: "c1", unitId: "u1", amount: 300_000, dueDate: AYER - 86_400 }),
    cargo({ id: "c2", unitId: "u1", amount: 200_000, dueDate: AYER, status: "partial" }),
    cargo({ id: "c3", unitId: "u1", amount: 150_000, dueDate: MANANA }),
    cargo({ id: "c4", unitId: "u2", amount: 500_000, dueDate: AYER, status: "paid" }),
  ];
  const pagos: PagoParaSaldo[] = [{ chargeId: "c2", amount: 50_000 }];

  test("separa saldo vencido de saldo abierto", () => {
    const u1 = saldosPorUnidad(cargos, pagos, AHORA).get("u1")!;
    assert.equal(u1.saldoVencido, 300_000 + 150_000);          // c1 + (c2 - 50k)
    assert.equal(u1.saldoAbierto, 300_000 + 150_000 + 150_000); // + c3, aun no vencido
    assert.equal(u1.cargosVencidos, 2);
  });

  test("reporta el vencimiento mas antiguo — alimenta la fecha de corte del aviso", () => {
    const u1 = saldosPorUnidad(cargos, pagos, AHORA).get("u1")!;
    assert.equal(u1.vencimientoMasAntiguo, AYER - 86_400);
  });

  test("una unidad al dia queda en cero, no desaparece", () => {
    const u2 = saldosPorUnidad(cargos, pagos, AHORA).get("u2")!;
    assert.equal(u2.saldoVencido, 0);
    assert.equal(u2.saldoAbierto, 0);
    assert.equal(u2.vencimientoMasAntiguo, null);
  });

  test("un cargo cubierto por completo con pagos no cuenta como vencido", () => {
    const saldos = saldosPorUnidad(
      [cargo({ id: "c9", unitId: "u9", amount: 100_000, dueDate: AYER })],
      [{ chargeId: "c9", amount: 100_000 }],
      AHORA,
    );
    const u9 = saldos.get("u9")!;
    assert.equal(u9.saldoVencido, 0);
    assert.equal(u9.cargosVencidos, 0);
  });

  test("suma varios pagos parciales sobre el mismo cargo", () => {
    const saldos = saldosPorUnidad(
      [cargo({ id: "c9", unitId: "u9", amount: 100_000, dueDate: AYER })],
      [{ chargeId: "c9", amount: 30_000 }, { chargeId: "c9", amount: 20_000 }],
      AHORA,
    );
    assert.equal(saldos.get("u9")!.saldoVencido, 50_000);
  });
});

describe("saldoDeUnidad", () => {
  test("no se contamina con cargos de otras unidades", () => {
    const cargos = [
      cargo({ id: "c1", unitId: "u1", amount: 100_000 }),
      cargo({ id: "c2", unitId: "u2", amount: 900_000 }),
    ];
    assert.equal(saldoDeUnidad("u1", cargos, [], AHORA).saldoVencido, 100_000);
  });

  test("una unidad sin cargos devuelve ceros, no undefined", () => {
    const s = saldoDeUnidad("fantasma", [], [], AHORA);
    assert.equal(s.saldoVencido, 0);
    assert.equal(s.unitId, "fantasma");
  });
});

describe("unidadesEnMora", () => {
  const cargos = [
    cargo({ id: "c1", unitId: "u1", amount: 100_000, dueDate: AYER }),
    cargo({ id: "c2", unitId: "u2", amount: 900_000, dueDate: AYER }),
    cargo({ id: "c3", unitId: "u3", amount: 1_200, dueDate: AYER }),   // bajo el umbral
    cargo({ id: "c4", unitId: "u4", amount: 400_000, dueDate: MANANA }), // no vencido
  ];

  test("excluye lo que esta por debajo del umbral — nada de avisos por centavos", () => {
    const ids = unidadesEnMora(cargos, [], AHORA).map((u) => u.unitId);
    assert.deepEqual(ids, ["u2", "u1"]);   // ordenadas de mayor a menor
    assert.ok(!ids.includes("u3"));
  });

  test("excluye unidades cuyo unico cargo aun no vence", () => {
    assert.ok(!unidadesEnMora(cargos, [], AHORA).some((u) => u.unitId === "u4"));
  });

  test("el umbral es configurable por edificio", () => {
    const ids = unidadesEnMora(cargos, [], AHORA, 1_000).map((u) => u.unitId);
    assert.ok(ids.includes("u3"));
  });

  test("una unidad que paga entre corridas sale de la lista", () => {
    const ids = unidadesEnMora(cargos, [{ chargeId: "c2", amount: 900_000 }], AHORA).map((u) => u.unitId);
    assert.deepEqual(ids, ["u1"]);
  });
});

describe("pagosPorCargo", () => {
  test("agrupa por cargo sin mezclar", () => {
    const m = pagosPorCargo([
      { chargeId: "a", amount: 10 }, { chargeId: "b", amount: 5 }, { chargeId: "a", amount: 7 },
    ]);
    assert.equal(m.get("a"), 17);
    assert.equal(m.get("b"), 5);
  });
});
