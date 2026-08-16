import { eq } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";

/**
 * Los edificios sobre los que corre un agente.
 *
 * Las rutas de cron no reciben slug: Vercel las invoca a secas. Así que cada
 * corrida resuelve por sí misma sobre qué edificios trabajar, leyendo la base
 * central. La especificación asumía un solo edificio; esto ya escala.
 *
 * Se excluyen los suspendidos y los que no tienen WhatsApp configurado — sin
 * número de Meta no hay por dónde mandar el aviso.
 */
export type EdificioActivo = { slug: string; nombre: string; whatsappPhoneId: string };

export async function edificiosParaAgentes(): Promise<EdificioActivo[]> {
  const central = getSuperadminDb();
  const filas = await central
    .select({
      slug: superadminSchema.buildings.slug,
      nombre: superadminSchema.buildings.name,
      whatsappPhoneId: superadminSchema.buildings.whatsappPhoneId,
      activeModules: superadminSchema.buildings.activeModules,
    })
    .from(superadminSchema.buildings)
    .where(eq(superadminSchema.buildings.status, "active"));

  return filas
    .filter((f): f is typeof f & { whatsappPhoneId: string } => Boolean(f.whatsappPhoneId))
    .filter((f) => {
      try {
        const modulos = JSON.parse(f.activeModules || "[]");
        return Array.isArray(modulos) && (modulos.includes("finanzas") || modulos.includes("base"));
      } catch {
        return false;
      }
    })
    .map((f) => ({ slug: f.slug, nombre: f.nombre, whatsappPhoneId: f.whatsappPhoneId }));
}
