CREATE TABLE `buildings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`address` text,
	`city` text,
	`country` text DEFAULT 'Colombia',
	`nit` text,
	`clerk_org_id` text NOT NULL,
	`turso_db_url` text NOT NULL,
	`turso_auth_token` text NOT NULL,
	`active_modules` text DEFAULT '["base"]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plan` text DEFAULT 'base' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buildings_slug_unique` ON `buildings` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `buildings_clerk_org_id_unique` ON `buildings` (`clerk_org_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`modules` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`current_period_start` integer NOT NULL,
	`current_period_end` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_stripe_subscription_id_unique` ON `subscriptions` (`stripe_subscription_id`);