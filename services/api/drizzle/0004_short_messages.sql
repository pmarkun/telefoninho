CREATE TABLE `short_message` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `family`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_member_id`) REFERENCES `family_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `short_message_from_created_idx` ON `short_message` (`from_member_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `short_message_to_created_idx` ON `short_message` (`to_member_id`,`created_at`);
