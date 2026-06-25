ALTER TABLE `parent_user` ADD `role` text DEFAULT 'responsible' NOT NULL;
--> statement-breakpoint
ALTER TABLE `parent_user` ADD `active` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `family` ADD `active` integer DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE `family_responsible` (
  `id` text PRIMARY KEY NOT NULL,
  `family_id` text NOT NULL,
  `parent_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`parent_user_id`) REFERENCES `parent_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_responsible_family_user_unique` ON `family_responsible` (`family_id`,`parent_user_id`);
