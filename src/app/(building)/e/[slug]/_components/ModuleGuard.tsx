import { isModuleActive, type Module } from "@/lib/modules/checker";
import { redirect } from "next/navigation";

/**
 * Componente servidor que protege rutas de módulo.
 * Si el módulo no está activo, redirige al dashboard.
 */
export async function requireModule(slug: string, module: Module) {
  const active = await isModuleActive(slug, module);
  if (!active) {
    redirect(`/e/${slug}/dashboard`);
  }
}
