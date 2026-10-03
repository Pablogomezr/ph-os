import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getSuperadminDb, superadminSchema } from "@/lib/db/superadmin";

/**
 * RUTA TEMPORAL — borrar junto con MIGRATION_SECRET_RENOMBRAR y su entrada en
 * isPublicRoute apenas se aplique.
 *
 * Corrige el nombre y el slug de Camacol en la base central:
 *   "edifcio-camacol" → "edificio-camacol", nombre → "Edificio Camacol".
 *
 * POST con header x-migration-secret y body { "action": "list" | "apply" }.
 */
const SLUG_VIEJO  = "edifcio-camacol";
const SLUG_NUEVO  = "edificio-camacol";
const NOMBRE      = "Edificio Camacol";

function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.MIGRATION_SECRET_RENOMBRAR;
  if (!esperado || !recibido) return false; // falla cerrado
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!secretoValido(req.headers.get("x-migration-secret"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const db = getSuperadminDb();
  const { buildings } = superadminSchema;

  const edificios = await db
    .select({ id: buildings.id, name: buildings.name, slug: buildings.slug })
    .from(buildings)
    .all();

  if (action === "list") {
    return NextResponse.json({ edificios });
  }

  if (action === "apply") {
    const viejo = edificios.find((e) => e.slug === SLUG_VIEJO);
    if (!viejo) {
      return NextResponse.json({ error: `No existe el slug ${SLUG_VIEJO}`, edificios }, { status: 404 });
    }
    if (edificios.some((e) => e.slug === SLUG_NUEVO)) {
      return NextResponse.json({ error: `El slug ${SLUG_NUEVO} ya está en uso`, edificios }, { status: 409 });
    }

    await db
      .update(buildings)
      .set({ slug: SLUG_NUEVO, name: NOMBRE, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(buildings.id, viejo.id));

    const despues = await db
      .select({ id: buildings.id, name: buildings.name, slug: buildings.slug })
      .from(buildings)
      .where(eq(buildings.id, viejo.id))
      .get();

    return NextResponse.json({ antes: viejo, despues });
  }

  return NextResponse.json({ error: 'action debe ser "list" o "apply"' }, { status: 400 });
}
