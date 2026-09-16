ALTER TABLE "trainings" DROP CONSTRAINT "trainings_date_not_future";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "timezone" text DEFAULT 'Europe/Berlin' NOT NULL;