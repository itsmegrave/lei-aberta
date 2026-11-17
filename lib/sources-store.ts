// Node-only helpers for crawlers and the build: data/sources/<id>.json manifests plus their crawl state.
// Manifests (name, description, coverage...) are committed to main and change through pull requests.
// The fields a crawl changes (STATE_FIELDS: status, counts, last run, cursor) go to data/status/sources.json,
// which lives on the `data` branch with the laws, because the nightly jobs can't commit to main.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stateOf, validateSource, withState, type DataSource, type SourceState } from "./sources.ts";

export const SOURCES_DIR = path.join(process.cwd(), "data", "sources");

/** Crawl state file that goes with a manifests folder: <data>/status/sources.json next to <data>/sources. */
export const statusFileFor = (sourcesDir: string) => path.join(sourcesDir, "..", "status", "sources.json");

export async function readSources(dir = SOURCES_DIR): Promise<DataSource[]> {
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: DataSource[] = [];
  for (const f of files.sort()) {
    const s = JSON.parse(await readFile(path.join(dir, f), "utf8")) as DataSource;
    const errors = validateSource(s, f);
    if (errors.length) throw new Error(`data/sources/${f}: ${errors.join("; ")}`);
    out.push(s);
  }
  return out;
}

/** Crawl state of every source, by id. Empty when the file is missing or unreadable. */
export async function readSourceStates(file: string): Promise<Record<string, SourceState>> {
  try {
    const all = JSON.parse(await readFile(file, "utf8")) as Record<string, SourceState>;
    return Object.fromEntries(Object.entries(all).map(([id, s]) => [id, stateOf(s)]));
  } catch {
    return {};
  }
}

/** Crawl state of one source, or undefined. */
export async function readSourceState(id: string, sourcesDir = SOURCES_DIR): Promise<SourceState | undefined> {
  return (await readSourceStates(statusFileFor(sourcesDir)))[id];
}

/**
 * Crawlers call this at the end of each run. Merges `patch` into the source (manifest plus crawl state),
 * validates, and writes both the manifest and the crawl state. Example after a successful run:
 *   await updateSource("senado", { status: "active", records: 812, lastRun: now, lastSuccess: now });
 * After a failed run: await updateSource("senado", { status: "failing", lastRun: now });
 */
export async function updateSource(id: string, patch: Partial<DataSource>, dir = SOURCES_DIR): Promise<DataSource> {
  const file = path.join(dir, `${id}.json`);
  const statusFile = statusFileFor(dir);
  let current: Partial<DataSource> = {};
  try {
    current = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* new source */
  }
  const states = await readSourceStates(statusFile);
  current = { ...current, ...states[id] };
  const next = { ...current, ...patch, id } as DataSource;
  const errors = validateSource(next, `${id}.json`);
  if (errors.length) throw new Error(`source ${id}: ${errors.join("; ")}`);
  await mkdir(path.dirname(statusFile), { recursive: true });
  const sorted = Object.fromEntries(Object.entries({ ...states, [id]: stateOf(next) }).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(statusFile, JSON.stringify(sorted, null, 2) + "\n");
  // The manifest is written too: a new source, or a new description from a crawler, reaches main through a
  // pull request with this file. The nightly jobs only commit data/status to the data branch.
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/** Manifests with the crawl state laid over them (the site's build). */
export async function readSourcesWithState(dir = SOURCES_DIR): Promise<DataSource[]> {
  const [sources, states] = await Promise.all([readSources(dir), readSourceStates(statusFileFor(dir))]);
  return sources.map((s) => withState(s, states[s.id]));
}
