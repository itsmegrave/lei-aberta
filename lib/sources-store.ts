// Node-only helpers for crawlers and the build: read and write data/sources/<id>.json.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSource, type DataSource } from "./sources.ts";

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
export async function updateSource(id: string, patch: Partial<DataSource>, dir = SOURCES_DIR): Promise<DataSource> {
  const file = path.join(dir, `${id}.json`);
  let current: Partial<DataSource> = {};
  try {
    current = JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* new source */
  }
  const next = { ...current, ...patch, id } as DataSource;
  const errors = validateSource(next, `${id}.json`);
  if (errors.length) throw new Error(`source ${id}: ${errors.join("; ")}`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}
