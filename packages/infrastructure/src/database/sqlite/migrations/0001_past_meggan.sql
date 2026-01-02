DROP INDEX `projects_name_unique`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `default_branch`;--> statement-breakpoint
ALTER TABLE `workspaces` DROP COLUMN `branch`;