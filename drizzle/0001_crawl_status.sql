CREATE TABLE "crawl_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"crawler" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"run_url" text
);
--> statement-breakpoint
CREATE TABLE "source_status" (
	"id" text PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crawl_runs_crawler_started_idx" ON "crawl_runs" USING btree ("crawler","started_at");