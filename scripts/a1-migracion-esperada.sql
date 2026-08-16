-- ─────────────────────────────────────────────────────────────────────────────
-- Agente de Cartera A1 — migración esperada (SOLO PARA REVISIÓN)
--
-- Este archivo NO lo aplica nadie. Está aquí para que puedas leer y aprobar el
-- cambio antes de generarlo. El SQL real lo produce drizzle-kit a partir del
-- esquema, con:
--
--     npm run db:generate
--
-- que lo escribe en drizzle/tenant-migrations/ junto con su snapshot. Compara
-- el archivo generado contra este; deberían coincidir.
--
-- SOLO SE AGREGAN TABLAS. Ninguna tabla existente se altera: no se toca
-- charges, payments, users, units ni bank_movements. La migración es aditiva
-- y, si algo saliera mal, revertirla es un DROP de estas tres tablas.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_after` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Un reintento del cron, un doble despliegue o una corrida manual chocan
-- contra este índice y no producen un segundo job.
CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);
--> statement-breakpoint

-- El worker barre por (estado, cuándo toca). Sin este índice, cada corrida
-- haría un scan completo de la cola.
CREATE INDEX `jobs_status_run_after` ON `jobs` (`status`,`run_after`);
--> statement-breakpoint

CREATE TABLE `agent_log` (
	`id` text PRIMARY KEY NOT NULL,
	`agent` text NOT NULL,
	`action` text NOT NULL,
	`level` text NOT NULL,
	`unit_id` text,
	`input` text DEFAULT '{}' NOT NULL,
	`output` text DEFAULT '{}' NOT NULL,
	`result` text NOT NULL,
	`reason` text,
	`approved_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

CREATE INDEX `agent_log_agent_created` ON `agent_log` (`agent`,`created_at`);
--> statement-breakpoint

CREATE TABLE `cartera_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`period` text NOT NULL,
	`notice_type` integer NOT NULL,
	`balance_at_send` integer NOT NULL,
	`job_id` text,
	`recipient_user_id` text,
	`recipient_phone` text,
	`wa_message_id` text,
	`status` text DEFAULT 'reservado' NOT NULL,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- LA PIEZA CENTRAL DEL DISEÑO.
-- Garantiza que jamás salgan dos avisos del mismo tipo, a la misma unidad, en
-- el mismo período — pase lo que pase con reintentos, despliegues duplicados o
-- ejecuciones manuales. Un cobro duplicado destruye más confianza que un cobro
-- tardío, así que esta es la restricción que no se negocia.
CREATE UNIQUE INDEX `cartera_notices_unit_period_type` ON `cartera_notices` (`unit_id`,`period`,`notice_type`);
