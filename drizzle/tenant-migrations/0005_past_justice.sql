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
CREATE INDEX `agent_log_agent_created` ON `agent_log` (`agent`,`created_at`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `cartera_notices_unit_period_type` ON `cartera_notices` (`unit_id`,`period`,`notice_type`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `jobs_status_run_after` ON `jobs` (`status`,`run_after`);--> statement-breakpoint
-- payment_references YA EXISTE en la base de Camacol: se aplico en su momento
-- con db:push:tenant, sin generar migracion, asi que el historial no la conocia.
-- drizzle la incluye aqui porque para el es nueva. IF NOT EXISTS hace que la
-- migracion sea segura tanto en una base que ya la tiene como en una nueva.
-- Las tres tablas de A1 quedan con CREATE TABLE estricto a proposito: si alguna
-- ya existiera, quiero que falle y enterarme.
CREATE TABLE IF NOT EXISTS `payment_references` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`unit_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
