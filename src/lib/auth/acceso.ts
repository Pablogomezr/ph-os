/**
 * Regla de acceso al panel de administración de un edificio. Módulo sin
 * dependencias para poder probarlo con node:test.
 *
 * El panel /e/[slug] y todo lo que lo respalda (Server Actions, export, Stripe)
 * lo usan solo:
 *   - el superadmin del SaaS, y
 *   - los usuarios ACTIVOS de la tabla `users` de ESE edificio con rol de
 *     personal: admin o technician.
 *
 * Propietarios, arrendatarios y observadores tienen su portal en /r/[slug];
 * los operarios, el suyo en /op/[slug]. Un usuario de otro edificio no aparece
 * en la tabla de este, así que queda fuera.
 */

export const ROLES_PERSONAL = ["admin", "technician"] as const;

export type MiembroEdificio = { role: string; active: number } | null;

export type DecisionAcceso =
  | { permitido: true }
  | { permitido: false; motivo: "sin-sesion" | "no-miembro" | "inactivo" | "portal-residente" | "portal-operario" };

export function decidirAccesoPanel(params: {
  userId: string | null;
  superadminId: string | undefined;
  miembro: MiembroEdificio;
}): DecisionAcceso {
  const { userId, superadminId, miembro } = params;

  if (!userId) return { permitido: false, motivo: "sin-sesion" };
  // superadminId vacío o ausente nunca coincide: falla cerrado
  if (superadminId && userId === superadminId) return { permitido: true };

  if (!miembro) return { permitido: false, motivo: "no-miembro" };
  if (miembro.active !== 1) return { permitido: false, motivo: "inactivo" };

  if ((ROLES_PERSONAL as readonly string[]).includes(miembro.role)) {
    return { permitido: true };
  }
  if (miembro.role === "operator") return { permitido: false, motivo: "portal-operario" };
  return { permitido: false, motivo: "portal-residente" };
}
