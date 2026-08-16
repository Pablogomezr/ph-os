import { timingSafeEqual } from "node:crypto";

/**
 * Autenticación de las rutas de cron.
 *
 * Vercel envía `Authorization: Bearer $CRON_SECRET` en cada invocación. Ese
 * secreto NO lo crea Vercel: se define a mano como variable de entorno del
 * proyecto, y a partir de ahí Vercel lo adjunta.
 *
 * Las rutas de cron viven en isPublicRoute (Clerk no puede autenticarlas: no
 * hay sesión de usuario detrás de un cron), así que esta función es la ÚNICA
 * barrera. Sin ella, cualquiera que adivine la URL dispara el ciclo de cobro
 * del edificio.
 *
 * Falla cerrado igual que la firma del webhook: sin secreto configurado, no
 * pasa nadie.
 */
export function autorizacionCronValida(
  authorizationHeader: string | null | undefined,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return false;
  if (!authorizationHeader) return false;

  const esperado = `Bearer ${cronSecret}`;
  const recibido = authorizationHeader;

  // timingSafeEqual exige longitudes iguales. La comparación de longitud no es
  // constante en el tiempo, pero solo filtra la longitud del secreto, no su
  // contenido — que es lo que hay que proteger.
  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
