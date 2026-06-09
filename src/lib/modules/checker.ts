import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";
import { eq } from "drizzle-orm";

export type Module =
  | "base"
  | "finanzas"
  | "energia"
  | "mantenimiento"
  | "pqrs"
  | "contabilidad"
  | "mensajeria";

/**
 * Verifica si un módulo está activo para un edificio.
 * "base" siempre está activo.
 */
export async function isModuleActive(
  buildingSlug: string,
  module: Module
): Promise<boolean> {
  if (module === "base") return true;

  const db = getSuperadminDb();
  const building = await db
    .select({ activeModules: superadminSchema.buildings.activeModules })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, buildingSlug))
    .get();

  if (!building) return false;

  try {
    const modules: Module[] = JSON.parse(building.activeModules);
    return modules.includes(module);
  } catch {
    return false;
  }
}

/**
 * Retorna todos los módulos activos de un edificio.
 */
export async function getActiveModules(buildingSlug: string): Promise<Module[]> {
  const db = getSuperadminDb();
  const building = await db
    .select({ activeModules: superadminSchema.buildings.activeModules })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.slug, buildingSlug))
    .get();

  if (!building) return ["base"];

  try {
    return JSON.parse(building.activeModules) as Module[];
  } catch {
    return ["base"];
  }
}

/**
 * Labels y metadata de módulos para UI
 */
export const MODULE_META: Record<Module, { label: string; description: string; icon: string }> = {
  base: { label: "Base", description: "Dashboard, unidades y residentes", icon: "building-2" },
  finanzas: { label: "Finanzas", description: "Cargos, pagos y presupuesto", icon: "circle-dollar-sign" },
  energia: { label: "Energía", description: "Lecturas de medidores y facturación kWh", icon: "zap" },
  mantenimiento: { label: "Mantenimiento", description: "Activos, tareas y proveedores", icon: "wrench" },
  pqrs: { label: "PQRS", description: "Peticiones, quejas, reclamos y sugerencias", icon: "message-square" },
  contabilidad: { label: "Contabilidad", description: "Exportación World Office, Siigo, CSV", icon: "file-spreadsheet" },
  mensajeria: { label: "Mensajería", description: "Mensajes masivos e individuales", icon: "bell" },
};
