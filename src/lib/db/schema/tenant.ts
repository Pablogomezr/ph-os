import { sql } from "drizzle-orm";
import { text, integer, real, sqliteTable } from "drizzle-orm/sqlite-core";

/**
 * SCHEMA POR EDIFICIO (Tenant)
 * Cada edificio tiene su propia Turso DB con estas mismas tablas.
 * Datos completamente aislados entre edificios.
 */

// ─── USUARIOS ────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),           // = Clerk userId
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("resident"), // admin | resident | technician
  unitIds: text("unit_ids").notNull().default("[]"),  // JSON array
  phone: text("phone"),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── UNIDADES ─────────────────────────────────────────────────────────────────
export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),        // "101", "Local 3", "Oficina 205"
  type: text("type").notNull(),            // apartment | office | commercial
  floor: integer("floor"),
  areaMq: real("area_m2"),
  coefficient: real("coefficient").notNull(), // coeficiente de copropiedad
  ownerId: text("owner_id"),
  residentId: text("resident_id"),
  status: text("status").notNull().default("occupied"), // occupied | vacant | maintenance
  parkingSpots: text("parking_spots").notNull().default("[]"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── CARGOS ───────────────────────────────────────────────────────────────────
export const charges = sqliteTable("charges", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  concept: text("concept").notNull(),     // ordinary | extraordinary | energy | water | audit | other
  specificConcept: text("specific_concept"), // "Vatia" | "Triple A" | "Auditoría"
  description: text("description"),
  amount: real("amount").notNull(),       // COP
  dueDate: integer("due_date").notNull(),
  status: text("status").notNull().default("pending"), // pending | partial | paid | overdue
  periodStart: integer("period_start"),
  periodEnd: integer("period_end"),
  isMass: integer("is_mass").notNull().default(0),
  batchId: text("batch_id"),             // agrupa cargos masivos del mismo lote
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── PAGOS ────────────────────────────────────────────────────────────────────
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  chargeId: text("charge_id").notNull().references(() => charges.id),
  unitId: text("unit_id").notNull().references(() => units.id),
  amount: real("amount").notNull(),       // puede ser pago parcial
  paymentDate: integer("payment_date").notNull(),
  method: text("method").notNull(),       // cash | transfer | online
  reference: text("reference"),
  receiptUrl: text("receipt_url"),        // soporte en R2
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── LECTURAS DE ENERGÍA ──────────────────────────────────────────────────────
export const energyReadings = sqliteTable("energy_readings", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  meterNumber: text("meter_number"),
  previousReading: real("previous_reading").notNull(),
  currentReading: real("current_reading").notNull(),
  ratePerKwh: real("rate_per_kwh").notNull(),
  readingDate: integer("reading_date").notNull(),
  photoUrl: text("photo_url"),            // foto del medidor en R2
  chargeId: text("charge_id"),            // cargo generado al facturar
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── ACTIVOS ──────────────────────────────────────────────────────────────────
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),           // "Ascensor 1", "Bomba Principal"
  category: text("category").notNull(),   // elevator | pump | cctv | generator | other
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  location: text("location"),
  lastMaintenance: integer("last_maintenance"),
  nextMaintenance: integer("next_maintenance"), // alerta si < 30 días
  status: text("status").notNull().default("operational"), // operational | maintenance | offline
  notes: text("notes"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── TAREAS DE MANTENIMIENTO ──────────────────────────────────────────────────
export const maintenanceTasks = sqliteTable("maintenance_tasks", {
  id: text("id").primaryKey(),
  assetId: text("asset_id"),              // opcional — puede no estar ligado a activo
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),           // preventive | corrective
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  status: text("status").notNull().default("pending"), // pending | in_progress | completed | cancelled
  assignedTo: text("assigned_to"),        // nombre técnico externo
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  scheduledDate: integer("scheduled_date"),
  completedDate: integer("completed_date"),
  evidenceUrls: text("evidence_urls").default("[]"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── PQRS ─────────────────────────────────────────────────────────────────────
export const pqrs = sqliteTable("pqrs", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),           // petition | complaint | claim | suggestion
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // open | in_review | resolved | closed
  priority: text("priority").notNull().default("normal"),
  response: text("response"),
  attachments: text("attachments").default("[]"),
  resolvedAt: integer("resolved_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── COMUNICADOS ──────────────────────────────────────────────────────────────
export const communications = sqliteTable("communications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),           // announcement | circular | acta | invoice
  targetRoles: text("target_roles").notNull().default('["all"]'),
  targetUnitTypes: text("target_unit_types"),  // JSON: ["apartment","office"] | null
  attachmentUrls: text("attachment_urls").default("[]"),
  publishedAt: integer("published_at"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── HILOS DE MENSAJERÍA ──────────────────────────────────────────────────────
export const messageThreads = sqliteTable("message_threads", {
  id: text("id").primaryKey(),
  unitId: text("unit_id"),
  participantIds: text("participant_ids").notNull(), // JSON: ["userId1","userId2"]
  subject: text("subject"),
  lastMessageAt: integer("last_message_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => messageThreads.id),
  senderId: text("sender_id").notNull(),
  body: text("body").notNull(),
  readAt: integer("read_at"),             // null = no leído
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── AUDIT LOGS (INMUTABLES) ──────────────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),       // "charge.created", "payment.recorded"
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata").default("{}"),  // JSON con detalles del cambio
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  // INMUTABLE: nunca UPDATE ni DELETE en audit_logs
});

// ─── CONFIGURACIÓN DEL EDIFICIO ───────────────────────────────────────────────
export const buildingConfig = sqliteTable("building_config", {
  key: text("key").primaryKey(),          // "energy_rate", "export_format", etc.
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
});

// ─── TIPOS INFERIDOS ──────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Charge = typeof charges.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type EnergyReading = typeof energyReadings.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;
export type Pqrs = typeof pqrs.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type MessageThread = typeof messageThreads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
