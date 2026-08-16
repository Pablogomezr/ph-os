import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { autorizacionCronValida } from "@/lib/cron-auth";
import { edificiosParaAgentes } from "@/lib/agents/edificios";
import { encolarAvisos } from "@/lib/agents/a1-cartera/encolar";
import { esTipoAviso } from "@/lib/agents/a1-cartera/plantillas";

// Lee y escribe en Turso y usa node:crypto — nunca Edge.
export const runtime = "nodejs";

/**
 * Ciclo de avisos de mora — PASO 1: encolar.
 *
 * Vercel la invoca los días 6, 16 y 26 con ?tipo=1|2|3. Esta ruta NO envía
 * nada: selecciona, aplica el circuit breaker y deja jobs en la cola. Tiene
 * que responder rápido, y cada envío debe poder reintentarse por separado.
 *
 * Vercel no reintenta un cron que falla, así que si un edificio revienta, los
 * demás siguen — el error queda en el resumen, no tumba la corrida entera.
 */
export async function GET(req: NextRequest) {
  if (!autorizacionCronValida(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const tipoCrudo = Number(req.nextUrl.searchParams.get("tipo"));
  if (!esTipoAviso(tipoCrudo)) {
    return NextResponse.json({ error: "El parámetro tipo debe ser 1, 2 o 3" }, { status: 400 });
  }

  const ahora = Math.floor(Date.now() / 1000);
  const edificios = await edificiosParaAgentes();
  const resultados: Record<string, unknown> = {};

  for (const edificio of edificios) {
    try {
      const db = await getTenantDb(edificio.slug);
      resultados[edificio.slug] = await encolarAvisos(db, { tipo: tipoCrudo, ahora });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error(`A1 encolar — falló el edificio ${edificio.slug}:`, mensaje);
      resultados[edificio.slug] = { error: mensaje };
    }
  }

  return NextResponse.json({ tipo: tipoCrudo, ahora, edificios: resultados });
}
