// Batched insert-or-update by id. Used by the JSON import and by the crawler store.
import { sql } from "drizzle-orm";
import type { Policy } from "../types.ts";
import type { Db } from "./client.ts";
import { toDbRow } from "./codec.ts";
import { policies } from "./schema.ts";

const BATCH = 500;

/** Columns overwritten on conflict: every column except the key and the generated search vector. */
const updateSet = Object.fromEntries(
  Object.entries(policies)
    .filter(([key, col]) => key !== "id" && key !== "search" && typeof col === "object" && col && "name" in col)
    .map(([key, col]) => [key, sql.raw(`excluded."${(col as { name: string }).name}"`)]),
);

export async function upsertPolicies(db: Db, records: Policy[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const rows = records.slice(i, i + BATCH).map(toDbRow);
    await db
      .insert(policies)
      .values(rows)
      .onConflictDoUpdate({ target: policies.id, set: { ...updateSet, updatedAt: sql`now()` } });
    n += rows.length;
  }
  return n;
}
