// Reads and writes source_status: the crawl state of each data/sources manifest.
import { eq, sql } from "drizzle-orm";
import { stateOf, type SourceState } from "../sources.ts";
import type { Db } from "./client.ts";
import { sourceStatus } from "./schema.ts";

export async function readSourceStates(db: Db): Promise<Record<string, SourceState>> {
  const rows = await db.select().from(sourceStatus);
  return Object.fromEntries(rows.map((r) => [r.id, stateOf(r.state)]));
}

export async function readSourceState(db: Db, id: string): Promise<SourceState | undefined> {
  const [row] = await db.select().from(sourceStatus).where(eq(sourceStatus.id, id));
  return row ? stateOf(row.state) : undefined;
}

export async function writeSourceState(db: Db, id: string, state: SourceState): Promise<void> {
  const value = stateOf(state);
  await db
    .insert(sourceStatus)
    .values({ id, state: value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: sourceStatus.id, set: { state: value, updatedAt: sql`now()` } });
}
