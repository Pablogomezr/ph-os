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

/** Secciones del panel: una por carpeta de /e/[slug]. */
export const SECCIONES = [
  "dashboard", "unidades", "residentes", "finanzas", "energia", "mantenimiento",
  "pqrs", "mensajeria", "whatsapp", "contabilidad", "billing", "operadores",
] as const;
export type Seccion = (typeof SECCIONES)[number];

/** El técnico solo opera mantenimiento y energía; el admin, todo. */
export const SECCIONES_TECNICO: readonly Seccion[] = ["mantenimiento", "energia"];

export function seccionesPermitidas(role: string | null): readonly Seccion[] {
  // null = superadmin
  if (role === null || role === "admin") return SECCIONES;
  if (role === "technician") return SECCIONES_TECNICO;
  return [];
}

export type MiembroEdificio = { role: string; active: number } | null;

export type DecisionAcceso =
  | { permitido: true }
  | { permitido: false; motivo: "sin-sesion" | "no-miembro" | "inactivo" | "portal-residente" | "portal-operario" | "seccion-restringida" };

/**
 * Sin `seccion` decide si la persona entra al panel (el layout). Con `seccion`
 * decide además si puede usar esa sección (páginas, acciones y rutas).
 */
export function decidirAccesoPanel(params: {
  userId: string | null;
  superadminId: string | undefined;
  miembro: MiembroEdificio;
  seccion?: Seccion;
}): DecisionAcceso {
  const { userId, superadminId, miembro, seccion } = params;

  if (!userId) return { permitido: false, motivo: "sin-sesion" };
  // superadminId vacío o ausente nunca coincide: falla cerrado
  if (superadminId && userId === superadminId) return { permitido: true };

  if (!miembro) return { permitido: false, motivo: "no-miembro" };
  if (miembro.active !== 1) return { permitido: false, motivo: "inactivo" };

  if ((ROLES_PERSONAL as readonly string[]).includes(miembro.role)) {
    if (seccion && !seccionesPermitidas(miembro.role).includes(seccion)) {
      return { permitido: false, motivo: "seccion-restringida" };
    }
    return { permitido: true };
  }
  if (miembro.role === "operator") return { permitido: false, motivo: "portal-operario" };
  return { permitido: false, motivo: "portal-residente" };
}
