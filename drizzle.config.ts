import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema/superadmin.ts",
  out: "./drizzle/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_CENTRAL_URL!,
    authToken: process.env.TURSO_CENTRAL_AUTH_TOKEN!,
  },
} satisfies Config;
