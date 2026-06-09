import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema/tenant.ts",
  out: "./drizzle/tenant-migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_TENANT_URL ?? "file:./dev-tenant-seed.db",
    authToken: process.env.TURSO_TENANT_AUTH_TOKEN ?? "local-dev-token",
  },
} satisfies Config;
