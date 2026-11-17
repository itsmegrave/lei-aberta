// Node-only: the latest run of each crawler, in data/status/runs.json on the `data` branch. Written by
// scripts/crawl-run.ts from the crawl workflows; the site reads it through /api/coletas.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CrawlRun, CrawlRunStatus } from "./crawl-runs.ts";

/** One entry per crawler: its latest run, plus the id that ties the start and the finish of a run together. */
type RunsFile = Record<string, CrawlRun & { id: string }>;

export const RUNS_FILE = path.join(process.cwd(), "data", "status", "runs.json");

async function read(file: string): Promise<RunsFile> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as RunsFile;
  } catch {
    return {};
  }
}

async function write(file: string, runs: RunsFile): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(runs).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(file, JSON.stringify(sorted, null, 2) + "\n");
}

export async function startRun(run: { id: string; crawler: string; runUrl: string | null; at?: Date }, file = RUNS_FILE): Promise<void> {
  const runs = await read(file);
  runs[run.crawler] = {
    id: run.id,
    crawler: run.crawler,
    status: "running",
    startedAt: (run.at ?? new Date()).toISOString(),
    finishedAt: null,
    runUrl: run.runUrl,
    lastSuccessAt: runs[run.crawler]?.lastSuccessAt ?? null,
  };
  await write(file, runs);
}

/** Records the outcome of a started run. False when that run isn't the crawler's latest (nothing is written). */
export async function finishRun(id: string, status: Exclude<CrawlRunStatus, "running">, at = new Date(), file = RUNS_FILE): Promise<boolean> {
  const runs = await read(file);
  const run = Object.values(runs).find((r) => r.id === id);
  if (!run) return false;
  run.status = status;
  run.finishedAt = at.toISOString();
  if (status === "success") run.lastSuccessAt = run.finishedAt;
  await write(file, runs);
  return true;
}

/** The latest run of every crawler. */
export async function latestRuns(file = RUNS_FILE): Promise<CrawlRun[]> {
  return toRuns(await read(file));
}

/** Drops the internal ids, for the API. */
export function toRuns(runs: Record<string, CrawlRun & { id?: string }>): CrawlRun[] {
  return Object.values(runs).map(({ id: _id, ...r }) => r);
}
