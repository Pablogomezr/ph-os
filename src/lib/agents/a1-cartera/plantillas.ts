import { formatearCOP } from "@/lib/cartera/saldo";

/**
 * Plantillas de Meta para el ciclo de avisos de mora.
 *
 * Fuera de la ventana de 24 horas desde el último mensaje del usuario,
 * WhatsApp no permite texto libre: los avisos son conversaciones iniciadas por
 * el negocio y tienen que ir en plantillas pre-aprobadas.
 *
 * Esa restricción de Meta y el diseño de seguridad coinciden: la plantilla es
 * literalmente cerrada, el modelo no puede improvisar el texto, solo llenar
 * variables. Por eso estos avisos pueden ser VERDES (ejecución autónoma) sin
 * riesgo de que un agente escriba algo inconveniente.
 */

/**
 * Código de idioma con el que quedaron aprobadas las plantillas en Meta.
 * Si Meta las aprobó como "Español (COL)", cambiar a "es_CO" — si no coincide
 * exactamente, Meta rechaza cada envío.
 */
export const IDIOMA_PLANTILLA = "es";

/** Zona horaria del edificio. El servidor corre en UTC; sin esto, una fecha
 *  cerca de medianoche se corre un día en el texto del aviso. */
export const ZONA_HORARIA = "America/Bogota";

export const TIPOS_AVISO = [1, 2, 3] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const NOMBRE_PLANTILLA: Record<TipoAviso, string> = {
  1: "recordatorio_cuota_pendiente",   // día 6
  2: "aviso_saldo_vencido",            // día 16
  3: "preaviso_cobro_prejuridico",     // día 26
};

/** Días que se le dan al propietario para responder antes del preaviso (tipo 3). */
export const DIAS_PLAZO_PREJURIDICO = 10;

export function esTipoAviso(v: unknown): v is TipoAviso {
  return v === 1 || v === 2 || v === 3;
}

/** Primer nombre, como lo hace el resto del bot. */
export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto.trim();
}

/** "15 de agosto de 2026", en hora de Colombia. */
export function formatearFecha(epochSegundos: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric", month: "long", year: "numeric", timeZone: ZONA_HORARIA,
  }).format(new Date(epochSegundos * 1000));
}

/** Período contable "YYYY-MM" en hora de Colombia, no en UTC. */
export function periodoDe(epochSegundos: number): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", timeZone: ZONA_HORARIA,
  }).format(new Date(epochSegundos * 1000));
  return partes.slice(0, 7); // en-CA da "YYYY-MM-DD"
}

export type DatosAviso = {
  nombre: string;
  unidad: string;
  /** Saldo vencido en pesos enteros. */
  saldo: number;
  /** Epoch segundos del momento del envío. */
  ahora: number;
};

/**
 * Variables de la plantilla, en orden {{1}}, {{2}}, ...
 *
 *   tipo 1 → nombre, unidad, saldo
 *   tipo 2 → nombre, unidad, saldo, fecha de corte
 *   tipo 3 → nombre, unidad, saldo, fecha límite para responder
 */
export function variablesDeAviso(tipo: TipoAviso, d: DatosAviso): string[] {
  const base = [primerNombre(d.nombre), d.unidad, formatearCOP(d.saldo)];

  if (tipo === 1) return base;
  if (tipo === 2) return [...base, formatearFecha(d.ahora)];

  const limite = d.ahora + DIAS_PLAZO_PREJURIDICO * 86_400;
  return [...base, formatearFecha(limite)];
}
