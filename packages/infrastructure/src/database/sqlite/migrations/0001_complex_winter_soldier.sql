CREATE TABLE `message_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`text` text,
	`tool_call_id` text,
	`tool_name` text,
	`tool_input` text,
	`tool_output` text,
	`tool_status` text,
	`tool_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `content`;