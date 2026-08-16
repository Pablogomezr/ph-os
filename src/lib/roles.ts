/**
 * Roles de usuario dentro de un edificio.
 * Módulo liviano y sin dependencias — se puede importar tanto desde
 * Server Components como desde route handlers públicos (ej. el webhook
 * de WhatsApp, que no debe cargar Clerk).
 *
 *  resident   → Propietario. Gestiona: consulta, radica PQRS y reporta pagos.
 *  tenant     → Arrendatario. Gestiona igual que el propietario.
 *  observer   → Observador. SOLO LECTURA: consulta estado de cuenta, cargos y
 *               comunicados de su unidad, pero no radica PQRS ni reporta pagos.
 *               Caso de uso: el propietario supervisa mientras el arrendatario
 *               gestiona el inmueble.
 *  admin      → Administración del edificio.
 *  technician → Personal técnico / mantenimiento.
 */

/** Roles que solo pueden consultar información, nunca modificarla. */
export const READ_ONLY_ROLES = ["observer"] as const;

export function isReadOnlyRole(role: string): boolean {
  return (READ_ONLY_ROLES as readonly string[]).includes(role);
}
