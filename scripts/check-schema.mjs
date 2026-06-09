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

// Check columns
const cols = await client.execute("PRAGMA table_info(buildings)");
console.log("Columns:", cols.rows.map(r => r.name).join(", "));

// Show all data
const rows = await client.execute("SELECT * FROM buildings");
console.log("Row:", JSON.stringify(rows.rows[0]));
process.exit(0);
