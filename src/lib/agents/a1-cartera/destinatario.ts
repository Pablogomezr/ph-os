import { isReadOnlyRole } from "@/lib/roles";

/**
 * A quién se le manda el aviso de mora de una unidad.
 *
 * CRITERIO (decisión de producto, cambiar aquí y en ningún otro lado):
 *
 *   1. Se prefiere el PROPIETARIO (rol `resident`).
 *   2. Si el propietario no tiene teléfono cargado, cae al ARRENDATARIO
 *      (rol `tenant`).
 *   3. NUNCA al Observador — es solo consulta, y es regla de producto.
 *
 * El porqué del orden: en la Ley 675 la obligación de pagar la cuota de
 * administración recae sobre el propietario de la unidad; el arrendatario
 * responde frente a su arrendador por contrato, no frente a la copropiedad.
 * El tercer aviso anuncia cobro prejurídico, y ese proceso se sigue contra el
 * propietario — mandárselo al arrendatario sería notificar a quien no es parte.
 *
 * Si en Camacol resulta que quien de hecho paga es el arrendatario, la
 * alternativa es notificar a ambos en los avisos 1 y 2 y solo al propietario
 * en el 3. Cuesta lo mismo: cambiar PREFERENCIA_ROLES y devolver una lista.
 */

/** Orden de preferencia. El primero que tenga teléfono se lleva el aviso. */
export const PREFERENCIA_ROLES = ["resident", "tenant"] as const;

export type UsuarioCandidato = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  active: number;
  /** JSON array de unitIds, como lo guarda el esquema. */
  unitIds: string;
  createdAt: number;
};

export type Destinatario = {
  userId: string;
  nombre: string;
  telefono: string;
  rol: string;
};

export type MotivoSinDestinatario =
  | "sin_residentes"    // nadie registrado en la unidad
  | "solo_observador"   // solo hay cuentas de consulta
  | "sin_telefono";     // hay a quién escribirle, pero no hay número

export type ResolucionDestinatario =
  | { ok: true; destinatario: Destinatario }
  | { ok: false; motivo: MotivoSinDestinatario };

function unidadesDe(u: UsuarioCandidato): string[] {
  try {
    const parsed = JSON.parse(u.unitIds || "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // unitIds corrupto no debe tumbar la corrida entera del edificio.
    return [];
  }
}

function telefonoUtil(phone: string | null): string | null {
  const limpio = (phone ?? "").trim();
  // Un teléfono con menos de 7 dígitos no es un número, es basura de captura.
  return limpio.replace(/\D/g, "").length >= 7 ? limpio : null;
}

export function resolverDestinatario(
  unitId: string,
  usuarios: readonly UsuarioCandidato[],
): ResolucionDestinatario {
  const deLaUnidad = usuarios.filter((u) => u.active === 1 && unidadesDe(u).includes(unitId));

  if (deLaUnidad.length === 0) return { ok: false, motivo: "sin_residentes" };

  // El Observador queda fuera antes de cualquier otra consideración.
  const gestores = deLaUnidad.filter(
    (u) => !isReadOnlyRole(u.role) && (PREFERENCIA_ROLES as readonly string[]).includes(u.role),
  );

  if (gestores.length === 0) {
    const hayObservador = deLaUnidad.some((u) => isReadOnlyRole(u.role));
    return { ok: false, motivo: hayObservador ? "solo_observador" : "sin_residentes" };
  }

  for (const rol of PREFERENCIA_ROLES) {
    // Empate entre varios del mismo rol: el más antiguo, para que la elección
    // sea reproducible entre corridas y no dependa del orden del SELECT.
    const candidatos = gestores
      .filter((u) => u.role === rol)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

    for (const u of candidatos) {
      const telefono = telefonoUtil(u.phone);
      if (telefono) {
        return { ok: true, destinatario: { userId: u.id, nombre: u.name, telefono, rol: u.role } };
      }
    }
  }

  return { ok: false, motivo: "sin_telefono" };
}
