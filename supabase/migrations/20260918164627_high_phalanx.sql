ALTER TABLE "veo_matches" DROP CONSTRAINT "veo_matches_score_pair_check";--> statement-breakpoint
ALTER TABLE "veo_matches" ALTER COLUMN "own_score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "veo_matches" ALTER COLUMN "opponent_score" SET NOT NULL;