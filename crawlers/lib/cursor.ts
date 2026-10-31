// Incremental crawls: each source's data/sources/<id>.json keeps `lastSuccess`, committed with the data,
// so the next nightly run knows where the previous good run stopped.
import { readFile } from "node:fs/promises";
import path from "node:path";

/** The source's last successful run (ISO timestamp), or null if it never succeeded. */
export async function lastSuccess(sourceId: string, sourcesDir = path.join(process.cwd(), "data", "sources")): Promise<string | null> {
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
