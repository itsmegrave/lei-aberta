// Postgres schema for the catalog. One row per law; filterable fields get their own columns,
// nested lists (authors, sources) stay as JSON because they are only read whole.
import { getTableColumns, sql } from "drizzle-orm";
import { boolean, check, customType, date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { CrawlRunStatus } from "../crawl-runs.ts";
import type { SourceState } from "../sources.ts";
import type { Author, Executive, Policy } from "../types.ts";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const policies = pgTable(
  "policies",
  {
    id: text("id").primaryKey(),
    level: text("level").notNull().$type<Policy["level"]>(),
    jurisdiction: text("jurisdiction").notNull(),
    type: text("type").notNull(),
    number: text("number"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    year: integer("year").notNull(),
    presentedAt: date("presented_at"),
    signedAt: date("signed_at"),
    status: text("status").notNull(),
    areas: text("areas").array().notNull().default(sql`'{}'::text[]`),
    /** Parties of the authors at authorship. Never the executive's party. */
    parties: text("parties").array().notNull().default(sql`'{}'::text[]`),
    authors: jsonb("authors").notNull().default(sql`'[]'::jsonb`).$type<Author[]>(),
    executive: jsonb("executive").$type<Executive | null>(),
    /** Copy of executive.party so the home split by executive party is an indexed filter. */
    executiveParty: text("executive_party"),
    sources: jsonb("sources").notNull().$type<Policy["sources"]>(),
    bill: text("bill"),
    reissues: integer("reissues"),
    convertedInto: text("converted_into"),
    curated: boolean("curated").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || setweight(to_tsvector('portuguese', coalesce(summary, '')), 'B')`,
    ),
  },
  (t) => [
    index("policies_level_year_idx").on(t.level, t.year),
    index("policies_year_idx").on(t.year),
    index("policies_jurisdiction_idx").on(t.jurisdiction),
    index("policies_executive_party_idx").on(t.executiveParty),
    index("policies_areas_idx").using("gin", t.areas),
    index("policies_parties_idx").using("gin", t.parties),
    index("policies_search_idx").using("gin", t.search),
    // Every record must link at least one official source (the crawler store validates the host).
    check("policies_has_source", sql`jsonb_array_length(${t.sources}) > 0`),
  ],
);

export type PolicyRow = typeof policies.$inferSelect;
export type NewPolicyRow = typeof policies.$inferInsert;

/** Every column except the search vector, which only WHERE clauses need. Use with db.select(policyColumns). */
const { search: _search, ...readable } = getTableColumns(policies);
export const policyColumns = readable;
export type PolicyRead = Omit<PolicyRow, "search">;

/**
 * One row per crawler run, written by the nightly workflows (scripts/crawl-run.ts) when a crawl starts and
 * when it ends, so the site can say which crawler is collecting right now. `crawler` is the repo path that
 * data/sources/<id>.json manifests carry in their `crawler` field.
 */
export const crawlRuns = pgTable(
  "crawl_runs",
  {
    /** GitHub run id, attempt and crawler, so a start and its finish land on the same row. */
    id: text("id").primaryKey(),
    crawler: text("crawler").notNull(),
    /** running, success, failure or cancelled. */
    status: text("status").notNull().$type<CrawlRunStatus>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** Link to the GitHub Actions run, shown on the site. */
    runUrl: text("run_url"),
  },
  (t) => [index("crawl_runs_crawler_started_idx").on(t.crawler, t.startedAt)],
);

/**
 * What each crawler last wrote about a source: status, record count, first year, last run and last success
 * (the next incremental run's cursor). The descriptive part of a source (name, description, links) stays in
 * data/sources/<id>.json, changed through pull requests; main only takes PRs, so crawlers can't commit there.
 */
export const sourceStatus = pgTable("source_status", {
  /** data/sources/<id>.json id. */
  id: text("id").primaryKey(),
  state: jsonb("state").notNull().$type<SourceState>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
