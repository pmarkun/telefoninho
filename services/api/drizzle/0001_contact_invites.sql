CREATE TABLE `contact_invite` (
  `id` text PRIMARY KEY NOT NULL,
  `target_member_id` text NOT NULL,
  `token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `revoked_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`target_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_invite_token_unique` ON `contact_invite` (`token`);
--> statement-breakpoint
CREATE TABLE `contact_request` (
  `id` text PRIMARY KEY NOT NULL,
  `invite_id` text NOT NULL,
  `family_id` text NOT NULL,
  `requester_member_id` text NOT NULL,
  `target_member_id` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `resolved_by_parent_id` text,
  `resolved_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`invite_id`) REFERENCES `contact_invite`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`requester_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`target_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`resolved_by_parent_id`) REFERENCES `parent_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contact_request_family_id_idx` ON `contact_request` (`family_id`);
--> statement-breakpoint
CREATE INDEX `contact_request_status_idx` ON `contact_request` (`status`);
