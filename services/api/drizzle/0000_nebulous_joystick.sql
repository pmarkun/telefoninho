CREATE TABLE `allowed_call` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `call_log` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`from_member_id` text,
	`to_member_id` text,
	`from_extension` text NOT NULL,
	`to_extension` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_seconds` integer,
	`status` text DEFAULT 'missed' NOT NULL,
	`block_reason` text,
	FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `family` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_member` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`kind` text DEFAULT 'child' NOT NULL,
	`display_name` text NOT NULL,
	`avatar_key` text DEFAULT 'star_pixel_01' NOT NULL,
	`color_key` text DEFAULT 'green' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pairing_code` (
	`id` text PRIMARY KEY NOT NULL,
	`family_member_id` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairing_code_code_unique` ON `pairing_code` (`code`);--> statement-breakpoint
CREATE TABLE `parent_user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_user_email_unique` ON `parent_user` (`email`);--> statement-breakpoint
CREATE TABLE `quiet_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`family_member_id` text NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`start_local_time` text DEFAULT '21:00' NOT NULL,
	`end_local_time` text DEFAULT '07:00' NOT NULL,
	`days_of_week` text DEFAULT 'mon,tue,wed,thu,fri,sat,sun' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sip_account` (
	`id` text PRIMARY KEY NOT NULL,
	`family_member_id` text NOT NULL,
	`extension` text NOT NULL,
	`username` text NOT NULL,
	`password_hash_or_encrypted` text NOT NULL,
	`plaintext_password` text,
	`domain` text DEFAULT '127.0.0.1' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sip_account_family_member_id_unique` ON `sip_account` (`family_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sip_account_extension_unique` ON `sip_account` (`extension`);--> statement-breakpoint
CREATE UNIQUE INDEX `sip_account_username_unique` ON `sip_account` (`username`);