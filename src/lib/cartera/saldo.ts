/**
 * FUENTE ÚNICA DE VERDAD DEL SALDO DE UNA UNIDAD
 *
 * Antes de este módulo, el panel de administración y el portal del residente
 * calculaban el saldo de formas distintas y mostraban cifras distintas para la
 * misma unidad:
 *
 *   - El admin restaba los pagos aplicados y derivaba el estado "vencido"
 *     comparando dueDate contra la fecha actual.
 *   - El portal del residente sumaba el monto completo de todo cargo no pagado
 *     (sin restar pagos parciales) y contaba vencidos filtrando por
 *     status === "overdue", un estado que NUNCA se escribe en la base — por lo
 *     que al propietario siempre le mostraba cero vencidos.
 *
 * El agente de cartera cobra con esta cifra. Que el propietario reciba un aviso
 * por un monto que no coincide con el que ve en su portal es indefendible, así
 * que las tres vistas —admin, portal y agente— consumen este módulo.
 *
 * DECISIONES DE DISEÑO
 *
 * 1. "Vencido" se DERIVA, no se lee. El estado `overdue` no existe en la base;
 *    un cargo está vencido si no está pagado y su fecha de vencimiento ya pasó.
 *
 * 2. Se restan TODOS los pagos registrados, verificados contra el banco o no.
 *    Un propietario que reportó su pago y está en "pendiente de revisión" no
 *    debe recibir un aviso de cobro: el costo de un aviso injusto es mayor que
 *    el de un aviso tarde.
 *
 * 3. El módulo es puro y sin dependencias — no importa Drizzle, Next ni
 *    `server-only`. Así se puede probar sin levantar base de datos, y lo pueden
 *    importar tanto Server Components como el worker de la cola.
 *
 * 4. Los montos se devuelven en PESOS ENTEROS. El esquema guarda `real` por
 *    razones históricas; el redondeo se hace una sola vez, aquí, para que
 *    ninguna vista invente su propio criterio.
 */

/** Único estado que cancela un cargo. Todo lo demás cuenta como saldo abierto. */
const ESTADO_PAGADO = "paid";

/**
 * Piso por debajo del cual no se cobra (pesos). Evita avisos por diferencias
 * de redondeo. Sobreescribible por edificio vía building_config.
 */
export const UMBRAL_MINIMO_COP = 5_000;

export type CargoParaSaldo = {
  id: string;
  unitId: string;
  amount: number;
  /** Epoch en SEGUNDOS, como todo el esquema. */
  dueDate: number;
  status: string;
};

export type PagoParaSaldo = {
  chargeId: string;
  amount: number;
};

export type SaldoUnidad = {
  unitId: string;
  /** Todo lo no pagado, esté vencido o no. Es lo que el portal llama "Saldo pendiente". */
  saldoAbierto: number;
  /** Solo lo vencido. Es la cifra con la que cobra el agente. */
  saldoVencido: number;
  cargosVencidos: number;
  /** Vencimiento del cargo vencido más antiguo. Epoch segundos, o null. */
  vencimientoMasAntiguo: number | null;
};

/** Suma los pagos registrados agrupados por cargo. */
export function pagosPorCargo(pagos: readonly PagoParaSaldo[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const p of pagos) {
    mapa.set(p.chargeId, (mapa.get(p.chargeId) ?? 0) + p.amount);
  }
  return mapa;
}

/**
 * Saldo pendiente de un cargo, en pesos enteros. Nunca negativo: un sobrepago
 * en un cargo no debe enmascarar la deuda de otro.
 */
export function saldoDeCargo(cargo: CargoParaSaldo, pagado: number): number {
  if (cargo.status === ESTADO_PAGADO) return 0;
  return Math.max(0, Math.round(cargo.amount - pagado));
}

/** Un cargo está vencido si no está pagado y su fecha de vencimiento ya pasó. */
export function estaVencido(cargo: CargoParaSaldo, ahora: number): boolean {
  return cargo.status !== ESTADO_PAGADO && cargo.dueDate < ahora;
}

/**
 * Estado efectivo de un cargo para mostrar en pantalla. Reemplaza los dos
 * cálculos divergentes que había en el panel admin y en el portal.
 */
export function estadoEfectivo(cargo: CargoParaSaldo, ahora: number): string {
  return estaVencido(cargo, ahora) ? "overdue" : cargo.status;
}

/** Saldos de todas las unidades presentes en `cargos`. */
export function saldosPorUnidad(
  cargos: readonly CargoParaSaldo[],
  pagos: readonly PagoParaSaldo[],
  ahora: number,
): Map<string, SaldoUnidad> {
  const pagado = pagosPorCargo(pagos);
  const saldos = new Map<string, SaldoUnidad>();

  for (const cargo of cargos) {
    const pendiente = saldoDeCargo(cargo, pagado.get(cargo.id) ?? 0);

    let u = saldos.get(cargo.unitId);
    if (!u) {
      u = {
        unitId: cargo.unitId,
        saldoAbierto: 0,
        saldoVencido: 0,
        cargosVencidos: 0,
        vencimientoMasAntiguo: null,
      };
      saldos.set(cargo.unitId, u);
    }

    if (pendiente === 0) continue;

    u.saldoAbierto += pendiente;

    if (estaVencido(cargo, ahora)) {
      u.saldoVencido += pendiente;
      u.cargosVencidos += 1;
      if (u.vencimientoMasAntiguo === null || cargo.dueDate < u.vencimientoMasAntiguo) {
        u.vencimientoMasAntiguo = cargo.dueDate;
      }
    }
  }

  return saldos;
}

/** Saldo de una sola unidad. Devuelve ceros si la unidad no tiene cargos. */
export function saldoDeUnidad(
  unitId: string,
  cargos: readonly CargoParaSaldo[],
  pagos: readonly PagoParaSaldo[],
  ahora: number,
): SaldoUnidad {
  return (
    saldosPorUnidad(cargos.filter((c) => c.unitId === unitId), pagos, ahora).get(unitId) ?? {
      unitId,
      saldoAbierto: 0,
      saldoVencido: 0,
      cargosVencidos: 0,
      vencimientoMasAntiguo: null,
    }
  );
}

/**
 * Unidades que el agente de cartera debe notificar: saldo vencido por encima
 * del umbral. Ordenadas de mayor a menor deuda para que la bitácora y las
 * alertas al administrador sean legibles.
 */
export function unidadesEnMora(
  cargos: readonly CargoParaSaldo[],
  pagos: readonly PagoParaSaldo[],
  ahora: number,
  umbral: number = UMBRAL_MINIMO_COP,
): SaldoUnidad[] {
  return [...saldosPorUnidad(cargos, pagos, ahora).values()]
    .filter((u) => u.saldoVencido >= umbral)
    .sort((a, b) => b.saldoVencido - a.saldoVencido);
}

/** Formato de moneda para el texto de los avisos y para las vistas. */
export function formatearCOP(pesos: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(pesos);
}
