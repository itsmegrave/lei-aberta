CREATE TABLE "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"type" text NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"year" integer NOT NULL,
	"presented_at" date,
	"signed_at" date,
	"status" text NOT NULL,
	"areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"parties" text[] DEFAULT '{}'::text[] NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"executive" jsonb,
	"executive_party" text,
	"sources" jsonb NOT NULL,
	"bill" text,
	"reissues" integer,
	"converted_into" text,
	"curated" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || setweight(to_tsvector('portuguese', coalesce(summary, '')), 'B')) STORED,
	CONSTRAINT "policies_has_source" CHECK (jsonb_array_length("policies"."sources") > 0)
);
--> statement-breakpoint
CREATE INDEX "policies_level_year_idx" ON "policies" USING btree ("level","year");--> statement-breakpoint
CREATE INDEX "policies_year_idx" ON "policies" USING btree ("year");--> statement-breakpoint
CREATE INDEX "policies_jurisdiction_idx" ON "policies" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "policies_executive_party_idx" ON "policies" USING btree ("executive_party");--> statement-breakpoint
CREATE INDEX "policies_areas_idx" ON "policies" USING gin ("areas");--> statement-breakpoint
CREATE INDEX "policies_parties_idx" ON "policies" USING gin ("parties");--> statement-breakpoint
CREATE INDEX "policies_search_idx" ON "policies" USING gin ("search");