CREATE TABLE `asterisk_config_state` (
  `id` text PRIMARY KEY NOT NULL,
  `pending` integer DEFAULT false NOT NULL,
  `last_generated_at` integer,
  `last_applied_at` integer,
  `last_error` text,
  `updated_at` integer NOT NULL
);
