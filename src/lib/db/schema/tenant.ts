import { sql } from "drizzle-orm";
import { text, integer, real, sqliteTable, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
  costCenter: text("cost_center"), // centro de costos contable (independiente del número/referencia)
  businessName: text("business_name"), // razón social de la empresa dueña/arrendataria, si aplica
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
  reference: text("reference"), // número de documento contable — FV-1234, rc-5678, NC-90, etc.
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
  // Estado de conciliación contra el extracto bancario real — ver bankMovements.
  // "unverified": aún no se cruzó contra el banco (o no hubo match).
  // "verified": el monto+referencia (o monto+fecha) coincide con un movimiento real.
  // "manual": un administrador lo verificó/aprobó a mano sin match automático.
  bankStatus: text("bank_status").notNull().default("unverified"),
  matchedMovementId: text("matched_movement_id"),
  // Residente identificado por número de WhatsApp que reportó el pago
  // (null si se registró manualmente desde el panel de administración).
  reportedByUserId: text("reported_by_user_id"),
  reportedByPhone: text("reported_by_phone"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── MOVIMIENTOS BANCARIOS (extracto importado) ──────────────────────────────
export const bankMovements = sqliteTable("bank_movements", {
  id: text("id").primaryKey(),
  date: integer("date").notNull(),
  amount: real("amount").notNull(),
  reference: text("reference").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
});

// ─── ALIASES DE REFERENCIA DE PAGO ───────────────────────────────────────────
// Identificadores recurrentes (NIT, cédula, código, nombre+número) que ciertos
// terceros usan al pagar. Permiten reconocer de qué unidad viene un movimiento
// bancario aunque el monto no coincida exacto (pagos de varios meses).
export const paymentReferences = sqliteTable("payment_references", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(), // normalizado en MAYÚSCULAS
  unitId: text("unit_id").notNull(),
  note: text("note"),
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
  // Si tiene valores, el comunicado se dirige SOLO a estos usuarios puntuales
  // (ignora targetRoles/targetUnitTypes) — permite elegir arrendatarios
  // individuales o un subconjunto específico en vez de toda la categoría.
  targetUserIds: text("target_user_ids"),      // JSON: ["userId1","userId2"] | null
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

// ─── MENSAJES DE WHATSAPP (historial del bot de pagos/PQRS) ──────────────────
export const whatsappMessages = sqliteTable("whatsapp_messages", {
  id: text("id").primaryKey(),
  unitId: text("unit_id"),                // null si el número no está registrado
  phone: text("phone").notNull(),
  direction: text("direction").notNull(), // inbound | outbound
  type: text("type").notNull(),           // text | image | document
  content: text("content").notNull().default(""),
  mediaUrl: text("media_url"),
  linkedEntityType: text("linked_entity_type"), // pqrs | payment | null
  linkedEntityId: text("linked_entity_id"),
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


// ─── COLA DE TRABAJOS DE AGENTES ─────────────────────────────────────────────
// Genérica: la reutilizan A1..A7. Vercel no reintenta un cron que falla, y su
// propia documentación advierte que puede invocar el mismo cron más de una vez.
// Esta tabla suple lo primero (reintentos con backoff) y la clave de
// idempotencia protege de lo segundo.
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),                          // "aviso_cartera", y los que vengan
  payload: text("payload").notNull().default("{}"),      // SOLO ids. Nunca montos: se releen al ejecutar
  status: text("status").notNull().default("pendiente"), // pendiente | ejecutando | hecho | fallido | cancelado
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  // Epoch en SEGUNDOS, como todo el esquema. La especificación decía
  // milisegundos; mezclar unidades de tiempo en la misma base es un bug
  // esperando ocurrir, así que se unificó a segundos.
  runAfter: integer("run_after").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  error: text("error"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("jobs_status_run_after").on(t.status, t.runAfter),
]);

// ─── BITÁCORA DE AGENTES ─────────────────────────────────────────────────────
// La evidencia ante el consejo de administración. TODA ejecución deja fila,
// incluidas las omitidas: el silencio no es aceptable.
export const agentLog = sqliteTable("agent_log", {
  id: text("id").primaryKey(),
  agent: text("agent").notNull(),                        // "A1", "A0"…
  action: text("action").notNull(),                      // "encolar" | "aviso_1" | "aviso_2" | "aviso_3"
  level: text("level").notNull(),                        // verde | amarillo | rojo
  unitId: text("unit_id"),                               // null en corridas globales
  input: text("input").notNull().default("{}"),          // qué vio el agente
  output: text("output").notNull().default("{}"),        // qué hizo
  result: text("result").notNull(),                      // ok | omitido | error
  // Motivo separado del resultado, para poder agrupar: al mes sabes cuántos
  // avisos se omitieron por "saldo_cero" contra "sin_telefono".
  reason: text("reason"),
  approvedBy: text("approved_by"),                       // solo Amarillos
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  index("agent_log_agent_created").on(t.agent, t.createdAt),
]);

// ─── CONTROL DE AVISOS DE MORA ───────────────────────────────────────────────
export const carteraNotices = sqliteTable("cartera_notices", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => units.id),
  period: text("period").notNull(),                      // "YYYY-MM"
  noticeType: integer("notice_type").notNull(),          // 1 | 2 | 3
  // Pesos COP ENTEROS. El resto del esquema usa real por razones históricas;
  // el redondeo se hace una sola vez, en lib/cartera/saldo.ts.
  balanceAtSend: integer("balance_at_send").notNull(),
  // Qué job reservó esta fila. Distingue "mi propio reintento tras un fallo
  // conocido" de "otra ejecución reservó esto" — ver ejecutar.ts.
  jobId: text("job_id"),
  recipientUserId: text("recipient_user_id"),
  recipientPhone: text("recipient_phone"),
  waMessageId: text("wa_message_id"),                    // null hasta que Meta responde
  // La fila se RESERVA antes de enviar y se completa después. Así, una caída
  // entre el envío y el registro no produce un segundo aviso en el reintento.
  status: text("status").notNull().default("reservado"), // reservado | enviado | entregado | leido | fallido
  error: text("error"),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
}, (t) => [
  // La pieza que garantiza que jamás salgan dos avisos del mismo tipo a la
  // misma unidad en el mismo período, pase lo que pase con crons y despliegues.
  uniqueIndex("cartera_notices_unit_period_type").on(t.unitId, t.period, t.noticeType),
]);

// ─── TIPOS INFERIDOS ──────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Charge = typeof charges.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type BankMovement = typeof bankMovements.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type EnergyReading = typeof energyReadings.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type MaintenanceTask = typeof maintenanceTasks.$inferSelect;
export type Pqrs = typeof pqrs.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type MessageThread = typeof messageThreads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type AgentLogEntry = typeof agentLog.$inferSelect;
export type CarteraNotice = typeof carteraNotices.$inferSelect;
