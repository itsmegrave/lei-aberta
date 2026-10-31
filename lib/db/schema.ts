// Postgres schema for the catalog. One row per law; filterable fields get their own columns,
// nested lists (authors, sources) stay as JSON because they are only read whole.
import { sql } from "drizzle-orm";
import { boolean, check, customType, date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
