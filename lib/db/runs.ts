// Reads and writes crawl_runs. Written by scripts/crawl-run.ts from the crawl workflows, read by /api/coletas.
import { desc, eq, sql } from "drizzle-orm";
import type { CrawlRun, CrawlRunStatus } from "../crawl-runs.ts";
import type { Db } from "./client.ts";
import { crawlRuns } from "./schema.ts";

export async function startRun(db: Db, run: { id: string; crawler: string; runUrl: string | null; at?: Date }): Promise<void> {
  const startedAt = run.at ?? new Date();
  await db
    .insert(crawlRuns)
    .values({ id: run.id, crawler: run.crawler, status: "running", startedAt, runUrl: run.runUrl })
    // A re-run of the same step starts over.
    .onConflictDoUpdate({ target: crawlRuns.id, set: { status: "running", startedAt, finishedAt: null } });
}

export async function finishRun(db: Db, id: string, status: Exclude<CrawlRunStatus, "running">, at = new Date()): Promise<boolean> {
  const rows = await db.update(crawlRuns).set({ status, finishedAt: at }).where(eq(crawlRuns.id, id)).returning({ id: crawlRuns.id });
  return rows.length > 0;
}

/** The latest run of every crawler, with the end of its last successful run. */
export async function latestRuns(db: Db): Promise<CrawlRun[]> {
  const [latest, successes] = await Promise.all([
    db.selectDistinctOn([crawlRuns.crawler]).from(crawlRuns).orderBy(crawlRuns.crawler, desc(crawlRuns.startedAt)),
    db
      .select({ crawler: crawlRuns.crawler, at: sql<Date | string>`max(${crawlRuns.finishedAt})` })
      .from(crawlRuns)
      .where(eq(crawlRuns.status, "success"))
      .groupBy(crawlRuns.crawler),
  ]);
  const iso = (d: Date | string | null | undefined) => (d == null ? null : new Date(d).toISOString());
  return latest.map((r) => ({
    crawler: r.crawler,
    status: r.status,
    startedAt: iso(r.startedAt)!,
    finishedAt: iso(r.finishedAt),
    runUrl: r.runUrl,
    lastSuccessAt: iso(successes.find((s) => s.crawler === r.crawler)?.at),
  }));
}
