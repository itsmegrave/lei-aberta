import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Policy } from "./types";

interface IndexFile {
  updatedAt: string;
  sample?: boolean;
  files: { level: string; year: number; path: string; count: number }[];
}

const DATA_DIR = path.join(process.cwd(), "data");

/** Reads data/index.json and every per-level, per-year file it lists. Runs at build time. */
export async function loadCatalog(): Promise<{ policies: Policy[]; updatedAt: string; sample: boolean }> {
  const index = JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as IndexFile;
  const chunks = await Promise.all(
    index.files.map(async (f) => JSON.parse(await readFile(path.join(DATA_DIR, f.path), "utf8")) as Policy[]),
  );
  const policies = chunks.flat().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "pt"));
  return { policies, updatedAt: index.updatedAt, sample: Boolean(index.sample) };
}

/** Dub short links by law id (data/short-links.json). Missing file means no short links yet. */
export async function loadShortLinks(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "short-links.json"), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}
