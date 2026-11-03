// Live crawler status. The nightly workflows record each run in Postgres (crawl_runs); the site reads the latest
// run per crawler from /api/coletas and lays it over the data/sources manifests, which only change after a run
// commits. Client-safe: no database code here.
import type { DataSource, SourceStatus } from "./sources.ts";

export type CrawlRunStatus = "running" | "success" | "failure" | "cancelled";

/** Latest run of one crawler, as /api/coletas returns it. Timestamps are ISO strings. */
export interface CrawlRun {
  /** Repo path, e.g. "crawlers/federal/run.ts": the `crawler` field of the matching manifests. */
  crawler: string;
  status: CrawlRunStatus;
  startedAt: string;
  finishedAt: string | null;
  runUrl: string | null;
  /** End of the last successful run, if any. */
  lastSuccessAt: string | null;
}

/**
 * The longest crawl job runs 340 minutes. A run still marked "running" after 6 hours lost its runner before it
 * could record the outcome; the site stops calling it live.
 */
export const STALE_AFTER_MS = 6 * 3600 * 1000;

export function isCollecting(run: CrawlRun | undefined, now: number): boolean {
  return run?.status === "running" && now - Date.parse(run.startedAt) < STALE_AFTER_MS;
}

export interface LiveSource {
  /** Manifest status, or "failing" when a run newer than the manifest failed. */
  status: SourceStatus;
  /** True while the source's crawler is running. */
  collecting: boolean;
  /** When the current run started (only while collecting). */
  startedAt: string | null;
  /** The newer of the manifest's lastSuccess and the last successful run. */
  lastSuccess: string | null;
  runUrl: string | null;
}

const newer = (a: string | null | undefined, b: string | null | undefined) =>
  !a ? (b ?? null) : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b;

/** Merges a source's manifest with the latest run of its crawler. */
export function liveSource(s: DataSource, runs: CrawlRun[], now: number): LiveSource {
  const run = s.crawler ? runs.find((r) => r.crawler === s.crawler) : undefined;
  const collecting = isCollecting(run, now);
  const lastSuccess = newer(s.lastSuccess, run?.lastSuccessAt);
  let status = s.status;
  // A failed run after the manifest's last write: the commit with "failing" may not have deployed yet.
  if (run?.status === "failure" && run.finishedAt && (!s.lastRun || Date.parse(run.finishedAt) > Date.parse(s.lastRun))) status = "failing";
  // A success after the manifest said "failing" clears it. Planned and building sources keep their label.
  if (status === "failing" && run?.status === "success" && run.finishedAt && (!s.lastRun || Date.parse(run.finishedAt) > Date.parse(s.lastRun))) status = "active";
  return { status, collecting, startedAt: collecting ? run!.startedAt : null, lastSuccess, runUrl: run?.runUrl ?? null };
}

/** Row id for a GitHub Actions run, so the start and the finish of one crawl update the same row. */
export function runId(env: Record<string, string | undefined>, crawler: string): string | null {
  if (!env.GITHUB_RUN_ID) return null;
  return `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? "1"}-${crawler}`;
}

export function runUrl(env: Record<string, string | undefined>): string | null {
  if (!env.GITHUB_RUN_ID || !env.GITHUB_REPOSITORY) return null;
  return `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
}

/** Maps a GitHub step outcome (success, failure, cancelled, skipped) to a run status. */
export function outcomeStatus(outcome: string): Exclude<CrawlRunStatus, "running"> {
  return outcome === "success" ? "success" : outcome === "failure" ? "failure" : "cancelled";
}
