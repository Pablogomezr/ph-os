CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`brand` text,
	`model` text,
	`serial_number` text,
	`location` text,
	`last_maintenance` integer,
	`next_maintenance` integer,
	`status` text DEFAULT 'operational' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `building_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`concept` text NOT NULL,
	`specific_concept` text,
	`description` text,
	`amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`is_mass` integer DEFAULT 0 NOT NULL,
	`batch_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `communications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`type` text NOT NULL,
	`target_roles` text DEFAULT '["all"]' NOT NULL,
	`target_unit_types` text,
	`attachment_urls` text DEFAULT '[]',
	`published_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `energy_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`meter_number` text,
	`previous_reading` real NOT NULL,
	`current_reading` real NOT NULL,
	`rate_per_kwh` real NOT NULL,
	`reading_date` integer NOT NULL,
	`photo_url` text,
	`charge_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `maintenance_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_to` text,
	`estimated_cost` real,
	`actual_cost` real,
	`scheduled_date` integer,
	`completed_date` integer,
	`evidence_urls` text DEFAULT '[]',
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text,
	`participant_ids` text NOT NULL,
	`subject` text,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`charge_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_date` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`receipt_url` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pqrs` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`response` text,
	`attachments` text DEFAULT '[]',
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`floor` integer,
	`area_m2` real,
	`coefficient` real NOT NULL,
	`owner_id` text,
	`resident_id` text,
	`status` text DEFAULT 'occupied' NOT NULL,
	`parking_spots` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'resident' NOT NULL,
	`unit_ids` text DEFAULT '[]' NOT NULL,
	`phone` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);