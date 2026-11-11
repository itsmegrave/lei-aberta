// Incremental crawls: each source keeps `lastSuccess`, so the next nightly run knows where the previous good
// run stopped. Runs keep it in data/status/sources.json (on the data branch); data/sources/<id>.json may hold an
// older one from when manifests carried it. The later of the two wins.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSourceState } from "../../lib/sources-store.ts";

/** The source's last successful run (ISO timestamp), or null if it never succeeded. */
export async function lastSuccess(
  sourceId: string,
  sourcesDir = path.join(process.cwd(), "data", "sources"),
): Promise<string | null> {
  const fromState = (await readSourceState(sourceId, sourcesDir))?.lastSuccess ?? null;
  const fromFile = await fileLastSuccess(sourceId, sourcesDir);
  if (!fromState || !fromFile) return fromState ?? fromFile;
  return Date.parse(fromState) >= Date.parse(fromFile) ? fromState : fromFile;
}

async function fileLastSuccess(sourceId: string, sourcesDir: string): Promise<string | null> {
  try {
    const s = JSON.parse(await readFile(path.join(sourcesDir, `${sourceId}.json`), "utf8"));
    return typeof s.lastSuccess === "string" ? s.lastSuccess : null;
  } catch {
    return null;
  }
}

const DAY = 86_400_000;

/**
 * First day (YYYY-MM-DD) a run must look at: `overlapDays` before the cursor, so items published late
 * are still caught, but never less than `minDays` nor more than `maxDays` back from `now`.
 * With no cursor, `minDays` back.
 */
export function sinceDay(cursor: string | null, { overlapDays = 1, minDays = 0, maxDays = 60, now = new Date() } = {}): string {
  const floor = now.getTime() - maxDays * DAY;
  const ceil = now.getTime() - minDays * DAY;
  const fromCursor = cursor ? Date.parse(cursor) - overlapDays * DAY : ceil;
  return new Date(Math.min(ceil, Math.max(floor, Number.isNaN(fromCursor) ? ceil : fromCursor))).toISOString().slice(0, 10);
}

/** Years from the cursor's year (minus the overlap) to now's. */
export function sinceYear(cursor: string | null, opts: Parameters<typeof sinceDay>[1] = {}): number {
  return Number(sinceDay(cursor, opts).slice(0, 4));
}
