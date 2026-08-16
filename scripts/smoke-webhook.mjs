#!/usr/bin/env node
/**
 * Prueba de humo del webhook de WhatsApp — verificación de firma.
 *
 * Manda peticiones firmadas y sin firmar contra el handler real y comprueba
 * que responda lo que debe. NO envía mensajes de WhatsApp ni escribe en la
 * base: el payload es un evento de "status" (entrega/lectura), que el propio
 * parseIncomingWebhook descarta antes de llegar a processMessage.
 *
 * Uso:
 *   1) En una terminal:  npm run dev
 *   2) En otra:          node scripts/smoke-webhook.mjs
 *
 * Variables (o las toma de .env.local):
 *   WEBHOOK_URL             por defecto http://localhost:3000/api/whatsapp/webhook
 *   WHATSAPP_APP_SECRET     obligatoria
 *   WHATSAPP_VERIFY_TOKEN   opcional — si está, también prueba el handshake GET
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

// ─── Cargar .env.local sin dependencias ──────────────────────────────────────
try {
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no hay .env.local, se usan las del entorno */ }

const URL_WEBHOOK = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/whatsapp/webhook";
const SECRETO     = process.env.WHATSAPP_APP_SECRET;
const VERIFY      = process.env.WHATSAPP_VERIFY_TOKEN;

if (!SECRETO) {
  console.error("\n✗ Falta WHATSAPP_APP_SECRET.\n");
  console.error("  Ponla en .env.local, o trae todas las de Vercel con:");
  console.error("      vercel env pull .env.local\n");
  process.exit(1);
}

// Evento de status: sin `messages`, así que el handler responde 200 y no hace nada más.
const CUERPO = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    id: "0",
    changes: [{
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "0", phone_number_id: "0" },
        statuses: [{ id: "wamid.PRUEBA", status: "delivered", timestamp: "0" }],
      },
    }],
  }],
});

const firmar = (cuerpo, secreto) =>
  "sha256=" + createHmac("sha256", secreto).update(Buffer.from(cuerpo, "utf8")).digest("hex");

let fallos = 0;

async function caso(nombre, { cuerpo = CUERPO, firma, esperado }) {
  const headers = { "Content-Type": "application/json" };
  if (firma !== undefined && firma !== null) headers["X-Hub-Signature-256"] = firma;

  let res;
  try {
    res = await fetch(URL_WEBHOOK, { method: "POST", headers, body: cuerpo });
  } catch (err) {
    console.error(`  ✗ ${nombre}\n      no se pudo conectar a ${URL_WEBHOOK} — ¿está corriendo npm run dev?`);
    fallos++;
    return;
  }

  const ok = res.status === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? "✓" : "✗"} ${nombre}  →  ${res.status} (esperado ${esperado})`);
}

console.log(`\nProbando ${URL_WEBHOOK}\n`);
console.log("POST — verificación de firma");

await caso("firma válida", {
  firma: firmar(CUERPO, SECRETO),
  esperado: 200,
});

await caso("firma con otro App Secret", {
  firma: firmar(CUERPO, "secreto-del-atacante"),
  esperado: 401,
});

await caso("sin cabecera de firma (el ataque real)", {
  firma: null,
  esperado: 401,
});

await caso("cuerpo alterado después de firmar", {
  cuerpo: CUERPO.replace("delivered", "read"),
  firma: firmar(CUERPO, SECRETO),
  esperado: 401,
});

await caso("firma sin el prefijo sha256=", {
  firma: firmar(CUERPO, SECRETO).replace("sha256=", ""),
  esperado: 401,
});

await caso("cuerpo re-serializado (bytes distintos, mismo JSON)", {
  cuerpo: JSON.stringify(JSON.parse(CUERPO), null, 2),
  firma: firmar(CUERPO, SECRETO),
  esperado: 401,
});

if (VERIFY) {
  console.log("\nGET — handshake de suscripción");
  const probarGet = async (nombre, token, esperado) => {
    const u = new URL(URL_WEBHOOK);
    u.searchParams.set("hub.mode", "subscribe");
    u.searchParams.set("hub.verify_token", token);
    u.searchParams.set("hub.challenge", "reto-123");
    const res = await fetch(u);
    const ok = res.status === esperado;
    if (!ok) fallos++;
    console.log(`  ${ok ? "✓" : "✗"} ${nombre}  →  ${res.status} (esperado ${esperado})`);
  };
  await probarGet("verify token correcto", VERIFY, 200);
  await probarGet("verify token incorrecto", "token-malo", 403);
} else {
  console.log("\n(WHATSAPP_VERIFY_TOKEN no está definida — se omite la prueba del handshake GET)");
}

console.log(fallos === 0
  ? "\n✓ Todo en orden. El webhook solo acepta tráfico firmado por Meta.\n"
  : `\n✗ ${fallos} caso(s) fallaron.\n`);

process.exit(fallos === 0 ? 0 : 1);
