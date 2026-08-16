import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db/tenant";
import { autorizacionCronValida } from "@/lib/cron-auth";
import { edificiosParaAgentes } from "@/lib/agents/edificios";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import { marcarEjecutando, reclamarAtascados, tomarPendientes } from "@/lib/agents/shared/queue";
import { procesarJobAviso, type EnvioPlantilla } from "@/lib/agents/a1-cartera/ejecutar";
import { TIPO_JOB } from "@/lib/agents/a1-cartera/encolar";

export const runtime = "nodejs";

/** Tope por corrida, para no acercarse al límite de duración de la función. */
const JOBS_POR_CORRIDA = 20;

/**
 * Ciclo de avisos de mora — PASO 2: ejecutar la cola.
 *
 * Corre cada pocos minutos. Toma los jobs pendientes cuyo backoff ya venció,
 * los marca en exclusiva y los procesa con todos los guardarraíles.
 *
 * El envío se inyecta como dependencia: así la lógica del agente se puede
 * probar sin red, y el número de WhatsApp correcto se resuelve por edificio.
 */
export async function GET(req: NextRequest) {
  if (!autorizacionCronValida(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const ahora = Math.floor(Date.now() / 1000);
  const edificios = await edificiosParaAgentes();
  const resultados: Record<string, unknown> = {};

  for (const edificio of edificios) {
    try {
      const db = await getTenantDb(edificio.slug);

      // Jobs que quedaron colgados porque la función se cayó a mitad.
      const reclamados = await reclamarAtascados(db, ahora);

      const pendientes = await tomarPendientes(db, TIPO_JOB, ahora, JOBS_POR_CORRIDA);

      const enviar: EnvioPlantilla = ({ to, plantilla, idioma, variables }) =>
        sendWhatsAppTemplate(edificio.whatsappPhoneId, to, plantilla, idioma, variables);

      const porEstado: Record<string, number> = {};

      for (const job of pendientes) {
        // Si otra invocación lo tomó primero, este worker lo deja pasar.
        const mio = await marcarEjecutando(db, job.id, ahora);
        if (!mio) continue;

        const r = await procesarJobAviso(db, { ...job, attempts: job.attempts + 1 }, { enviar, ahora });
        const clave = r.estado === "omitido" || r.estado === "revisar" ? `${r.estado}:${r.motivo}` : r.estado;
        porEstado[clave] = (porEstado[clave] ?? 0) + 1;
      }

      resultados[edificio.slug] = { reclamados, tomados: pendientes.length, porEstado };
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error(`A1 worker — falló el edificio ${edificio.slug}:`, mensaje);
      resultados[edificio.slug] = { error: mensaje };
    }
  }

  return NextResponse.json({ ahora, edificios: resultados });
}
