// Node-only helpers for crawlers and the build: read and write data/sources/<id>.json.
// With a database URL, the crawl state (status, counts, last run, cursor) is read from and written to
// Postgres (source_status) instead, because the nightly jobs can no longer commit to main.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stateOf, validateSource, withState, type DataSource, type SourceState } from "./sources.ts";

export const SOURCES_DIR = path.join(process.cwd(), "data", "sources");

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

/**
 * Crawlers call this at the end of each run. Merges `patch` into the source's file (creating it if needed),
 * validates, and writes it. Example after a successful run:
 *   await updateSource("senado", { status: "active", records: 812, lastRun: now, lastSuccess: now });
 * After a failed run: await updateSource("senado", { status: "failing", lastRun: now });
 */
export async function updateSource(
  id: string,
  patch: Partial<DataSource>,
  dir = SOURCES_DIR,
  databaseUrl = process.env.CRAWL_DATABASE_URL,
): Promise<DataSource> {
  const file = path.join(dir, `${id}.json`);
  let current: Partial<DataSource> = {};
  try {
    current = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* new source */
  }
  if (databaseUrl) current = { ...current, ...(await readSourceStateFrom(databaseUrl, id)) };
  const next = { ...current, ...patch, id } as DataSource;
  const errors = validateSource(next, `${id}.json`);
  if (errors.length) throw new Error(`source ${id}: ${errors.join("; ")}`);
  // A status that can't be saved must not fail a crawl whose laws are already in the database.
  if (databaseUrl)
    await withDb(databaseUrl, (db, m) => m.writeSourceState(db, id, stateOf(next))).catch((err) =>
      console.warn(`::warning::source ${id}: status not saved: ${err instanceof Error ? err.message : err}`),
    );
  // Also written in the database case: the PR smoke runs and local runs read the file, and a developer
  // can commit a manifest change (a new source, a new description) through a pull request.
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/** Crawl state from Postgres for one source; undefined without a database or a row. */
export async function readSourceStateFrom(databaseUrl: string | undefined, id: string): Promise<SourceState | undefined> {
  if (!databaseUrl) return undefined;
  try {
    return await withDb(databaseUrl, (db, m) => m.readSourceState(db, id));
  } catch (err) {
    console.warn(`::warning::source ${id}: status not read, using data/sources: ${err instanceof Error ? err.message : err}`);
    return undefined;
  }
}

/** Manifests with the crawl state from Postgres laid over them (the site's build and /api/coletas). */
export async function readSourcesWithState(databaseUrl = process.env.DATABASE_URL, dir = SOURCES_DIR): Promise<DataSource[]> {
  const sources = await readSources(dir);
  if (!databaseUrl) return sources;
  try {
    const { getDb } = await import("./db/client.ts");
    const { readSourceStates } = await import("./db/source-status.ts");
    const states = await readSourceStates(getDb(databaseUrl));
    return sources.map((s) => withState(s, states[s.id]));
  } catch (err) {
    console.error("source_status:", err);
    return sources;
  }
}

// Crawlers open and close their own connection per call, like the crawler store, and load the database
// modules lazily so runs without a database need no npm install.
async function withDb<T>(url: string, fn: (db: import("./db/client.ts").Db, m: typeof import("./db/source-status.ts")) => Promise<T>): Promise<T> {
  const [{ getDb, closeDb }, m] = await Promise.all([import("./db/client.ts"), import("./db/source-status.ts")]);
  try {
    return await fn(getDb(url), m);
  } finally {
    await closeDb();
  }
}
