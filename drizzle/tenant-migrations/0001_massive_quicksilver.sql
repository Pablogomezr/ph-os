CREATE TABLE `bank_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`amount` real NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text,
	`phone` text NOT NULL,
	`direction` text NOT NULL,
	`type` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`media_url` text,
	`linked_entity_type` text,
	`linked_entity_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `communications` ADD `target_user_ids` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `bank_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `matched_movement_id` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `reported_by_user_id` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `reported_by_phone` text;