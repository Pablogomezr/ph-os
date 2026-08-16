import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la firma de los POST del webhook de WhatsApp.
 *
 * El WHATSAPP_VERIFY_TOKEN solo protege el handshake GET de suscripción: no
 * autentica ni un solo mensaje entrante. El mecanismo real para los POST es
 * distinto — Meta firma el cuerpo de cada notificación con HMAC-SHA256 usando
 * el App Secret de la aplicación y envía el resultado en la cabecera
 * `X-Hub-Signature-256: sha256=<hex>`.
 *
 * Sin esta verificación, cualquiera que conozca la URL del webhook puede
 * inventar pagos, radicar PQRS a nombre de un residente real y hacer que el
 * número de WhatsApp del edificio envíe mensajes a destinatarios arbitrarios.
 *
 * Reglas de esta implementación:
 *  1. Se firma sobre los BYTES EXACTOS del cuerpo. Si el cuerpo se parsea y se
 *     vuelve a serializar, el hash no coincide nunca — por eso el handler debe
 *     leer el cuerpo crudo ANTES de hacer JSON.parse.
 *  2. La comparación es timing-safe (crypto.timingSafeEqual), nunca `===`.
 *  3. Falla cerrado: si falta el App Secret o la cabecera, la firma NO es
 *     válida. Un secreto mal configurado debe tumbar el webhook de forma
 *     ruidosa, no dejarlo aceptando tráfico sin autenticar en silencio.
 */

const PREFIX = "sha256=";
const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function verifyMetaSignature(
  rawBody: Buffer | Uint8Array | string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return false;
  if (!signatureHeader) return false;
  if (!signatureHeader.startsWith(PREFIX)) return false;

  const received = signatureHeader.slice(PREFIX.length).trim().toLowerCase();
  if (!HEX_SHA256.test(received)) return false;

  const payload = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
  const expected = createHmac("sha256", appSecret).update(payload).digest();

  const receivedBuf = Buffer.from(received, "hex");
  if (receivedBuf.length !== expected.length) return false;

  return timingSafeEqual(receivedBuf, expected);
}

/** Firma un cuerpo igual que lo haría Meta. Solo para tests y depuración local. */
export function signBodyLikeMeta(rawBody: Buffer | Uint8Array | string, appSecret: string): string {
  const payload = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
  return PREFIX + createHmac("sha256", appSecret).update(payload).digest("hex");
}
