CREATE TABLE "veo_match_stats" (
	"match_id" uuid NOT NULL,
	"team_association" text NOT NULL,
	"stat_type" text NOT NULL,
	"category" text NOT NULL,
	"value" integer NOT NULL,
	"period_values" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "veo_match_stats_match_id_team_association_stat_type_pk" PRIMARY KEY("match_id","team_association","stat_type"),
	CONSTRAINT "veo_match_stats_team_association_check" CHECK ("veo_match_stats"."team_association" in ('own','opponent'))
);
--> statement-breakpoint
CREATE TABLE "veo_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"veo_match_id" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"opponent_name" text NOT NULL,
	"own_score" integer,
	"opponent_score" integer,
	"home_or_away" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "veo_matches_veo_match_id_unique" UNIQUE("veo_match_id"),
	CONSTRAINT "veo_matches_home_or_away_check" CHECK ("veo_matches"."home_or_away" in ('home','away')),
	CONSTRAINT "veo_matches_score_pair_check" CHECK (("veo_matches"."own_score" is null) = ("veo_matches"."opponent_score" is null))
);
--> statement-breakpoint
CREATE TABLE "veo_sync_credentials" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"session_cookie" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veo_sync_status" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veo_team_mappings" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"veo_club_slug" text NOT NULL,
	"veo_team_slug" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veo_match_stats" ADD CONSTRAINT "veo_match_stats_match_id_veo_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."veo_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veo_matches" ADD CONSTRAINT "veo_matches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veo_sync_credentials" ADD CONSTRAINT "veo_sync_credentials_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veo_sync_status" ADD CONSTRAINT "veo_sync_status_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veo_team_mappings" ADD CONSTRAINT "veo_team_mappings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "veo_matches_team_idx" ON "veo_matches" USING btree ("team_id");