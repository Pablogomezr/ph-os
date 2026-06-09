import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);

const client = createClient({ url: env.TURSO_CENTRAL_URL, authToken: env.TURSO_CENTRAL_AUTH_TOKEN });

const result = await client.execute(
  "SELECT id, active_modules FROM buildings WHERE slug = 'torre-arboleda-85'"
);
const row = result.rows[0];
console.log("Current:", row.active_modules);

const modules = JSON.parse(row.active_modules);
if (!modules.includes("mensajeria")) {
  modules.push("mensajeria");
  await client.execute({
    sql: "UPDATE buildings SET active_modules = ? WHERE id = ?",
    args: [JSON.stringify(modules), row.id],
  });
  console.log("✅ Updated to:", JSON.stringify(modules));
} else {
  console.log("✅ mensajeria already active");
}
process.exit(0);
