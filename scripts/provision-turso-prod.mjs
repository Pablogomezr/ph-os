/**
 * scripts/provision-turso-prod.mjs
 *
 * Provisiona la infraestructura Turso para producción:
 *   1. Crea la DB central (ph-central)
 *   2. Genera un token para la DB central
 *   3. Muestra los valores para copiar a las variables de entorno de Vercel
 *
 * Uso:
 *   TURSO_API_TOKEN=<token> TURSO_ORG=<org-name> node scripts/provision-turso-prod.mjs
 *
 * Obtén tu API token en: https://app.turso.tech/settings/tokens
 * Obtén el nombre de tu org en: https://app.turso.tech (aparece en la URL)
 */

const API_TOKEN = process.env.TURSO_API_TOKEN;
const ORG = process.env.TURSO_ORG;

if (!API_TOKEN || !ORG) {
  console.error("❌  Faltan variables de entorno:");
  console.error("    TURSO_API_TOKEN=<token> TURSO_ORG=<org-name> node scripts/provision-turso-prod.mjs");
  process.exit(1);
}

const BASE = `https://api.turso.tech/v1/organizations/${ORG}`;
const HEADERS = {
  "Authorization": `Bearer ${API_TOKEN}`,
  "Content-Type": "application/json",
};

async function tursoFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, ...options });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Turso API ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log(`\n🚀  Provisionando Turso para org: ${ORG}\n`);

  // ── 1. Verificar / crear grupo "default" ────────────────────────────────────
  console.log("📦  Verificando grupo 'default'...");
  try {
    const groups = await tursoFetch("/groups");
    const hasDefault = groups.groups?.some((g) => g.name === "default");
    if (!hasDefault) {
      console.log("    Creando grupo 'default' en iad (Virginia)...");
      await tursoFetch("/groups", {
        method: "POST",
        body: JSON.stringify({ name: "default", location: "iad" }),
      });
      console.log("    ✅  Grupo creado.");
    } else {
      console.log("    ✅  Grupo 'default' ya existe.");
    }
  } catch (e) {
    console.warn("    ⚠️   No se pudo verificar grupos:", e.message);
  }

  // ── 2. Crear DB central ─────────────────────────────────────────────────────
  console.log("\n🗄️   Creando DB central 'ph-central'...");
  let centralHostname;

  try {
    const createData = await tursoFetch("/databases", {
      method: "POST",
      body: JSON.stringify({ name: "ph-central", group: "default" }),
    });
    centralHostname = createData.database?.Hostname;
    console.log("    ✅  DB creada:", centralHostname);
  } catch (e) {
    if (e.message.includes("already exists") || e.message.includes("409")) {
      console.log("    ℹ️   DB 'ph-central' ya existe. Obteniendo hostname...");
      const dbData = await tursoFetch("/databases/ph-central");
      centralHostname = dbData.database?.Hostname;
      console.log("    ✅  Hostname:", centralHostname);
    } else {
      throw e;
    }
  }

  // ── 3. Crear token para la DB central ──────────────────────────────────────
  console.log("\n🔑  Generando token para 'ph-central'...");
  const tokenData = await tursoFetch("/databases/ph-central/auth/tokens", {
    method: "POST",
    body: JSON.stringify({ authorization: "full-access" }),
  });
  const centralToken = tokenData.jwt;
  console.log("    ✅  Token generado.");

  // ── 4. Mostrar resultado ────────────────────────────────────────────────────
  const centralUrl = `libsql://${centralHostname}`;

  console.log("\n" + "═".repeat(70));
  console.log("✅  PROVISIONING COMPLETADO");
  console.log("═".repeat(70));
  console.log("\nCopia estas variables en Vercel (Settings → Environment Variables):\n");
  console.log(`TURSO_CENTRAL_URL=${centralUrl}`);
  console.log(`TURSO_CENTRAL_AUTH_TOKEN=${centralToken}`);
  console.log(`TURSO_API_TOKEN=${API_TOKEN}`);
  console.log(`TURSO_ORG=${ORG}`);
  console.log("\n" + "═".repeat(70));
  console.log("\nPróximo paso:");
  console.log("  Aplica el schema central con:");
  console.log("  TURSO_CENTRAL_URL=... TURSO_CENTRAL_AUTH_TOKEN=... npx drizzle-kit push");
  console.log("═".repeat(70) + "\n");
}

main().catch((e) => {
  console.error("❌  Error:", e.message);
  process.exit(1);
});
