import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

/**
 * DB CENTRAL — Turso
 * Contiene metadata de todos los edificios y suscripciones.
 * NO contiene datos de residentes ni finanzas — eso vive en la DB de cada edificio.
 */

export const buildings = sqliteTable("buildings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),         // URL: /edificio-camacol
  address: text("address"),
  city: text("city"),
  country: text("country").default("Colombia"),
  nit: text("nit"),
  clerkOrgId: text("clerk_org_id").unique().notNull(),
  tursoDbUrl: text("turso_db_url").notNull(),    // SECRETO — nunca al cliente
  tursoAuthToken: text("turso_auth_token").notNull(), // SECRETO — nunca al cliente
  activeModules: text("active_modules").notNull().default('["base"]'), // JSON array
  status: text("status").notNull().default("active"), // active | suspended | trial
  plan: text("plan").notNull().default("base"),
  whatsappPhoneId: text("whatsapp_phone_id"), // phone_number_id de Meta — enruta el webhook al edificio correcto
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  buildingId: text("building_id").notNull().references(() => buildings.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique().notNull(),
  modules: text("modules").notNull().default("[]"),
  status: text("status").notNull(), // active | past_due | cancelled
  currentPeriodStart: integer("current_period_start").notNull(),
  currentPeriodEnd: integer("current_period_end").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// Tipos inferidos para TypeScript
export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
