// Shared JSON store for every crawler: loads data/<level>/<year>.json, upserts records by id,
// and rewrites the touched year files plus data/index.json.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Policy } from "../../lib/types.ts";

export interface UpsertOptions {
  /**
   * owner=true: the caller is the authoritative source for this record; its fields overwrite.
   * owner=false: only fill fields that are null/empty in the existing record and append sources.
   * Sources are always merged (union, deduplicated by url), whichever side owns the record.
   */
  owner: boolean;
  /** Fields that keep an existing non-empty value even when owner=true (e.g. hand-edited summaries). */
  preserve?: (keyof Policy)[];
}

interface IndexFile {
  updatedAt: string;
  sample?: boolean;
  files: { level: string; year: number; path: string; count: number }[];
}

const isEmpty = (v: unknown) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function mergeSources(a: Policy["sources"], b: Policy["sources"]): Policy["sources"] {
  const seen = new Set<string>();
  const out: Policy["sources"] = [];
  for (const s of [...a, ...b]) {
    const key = s.url.replace(/^http:/, "https:").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function mergeRecord(existing: Policy | undefined, incoming: Policy, opts: UpsertOptions): Policy {
  if (!existing) return incoming;
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === "sources" || v === undefined) continue;
    const key = k as keyof Policy;
    const keep = opts.preserve?.includes(key) && !isEmpty(existing[key]);
    if (opts.owner ? !keep && !isEmpty(v) : isEmpty(existing[key])) out[k] = v;
  }
  // The owner's sources come first so the primary link stays on top.
  out.sources = opts.owner ? mergeSources(incoming.sources, existing.sources) : mergeSources(existing.sources, incoming.sources);
  return out as unknown as Policy;
}

/** Every record must carry at least one https link to an official (.gov.br / .leg.br / .jus.br) source. */
export function validate(p: Policy): string[] {
  const errors: string[] = [];
  if (!p.id || !p.level || !p.title || !p.year) errors.push("missing id/level/title/year");
  if (!p.sources?.some((s) => /^https:\/\/([a-z0-9-]+\.)*(gov|leg|jus|mp)\.br(\/|$)/i.test(s.url)))
    errors.push("no official https source");
  for (const a of p.authors ?? []) if (a.kind === "executive" && a.party) errors.push("executive author must not carry a party");
  return errors;
}

export interface Store {
  get(id: string): Policy | undefined;
  all(): Policy[];
  /** Merges a record. A merge that changes nothing leaves its file untouched, so quiet nights write nothing. */
  upsert(record: Policy, opts: UpsertOptions): Policy;
  /** Number of records added or changed since the store was opened. */
  changed(): number;
  remove(id: string): void;
  /** Writes touched files and index.json. Returns the number of files written. */
  save(): Promise<number>;
}

/** Key order can differ between a record read from disk and a freshly built one, so compare canonically. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
      : v;
export const sameRecord = (a: Policy, b: Policy) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const fileKey = (p: Pick<Policy, "level" | "year">) => `${p.level}/${p.year}.json`;

export async function openStore(dataDir: string): Promise<Store> {
  const records = new Map<string, Policy>();
  const touched = new Set<string>();
  const changedIds = new Set<string>();
  let index: IndexFile = { updatedAt: "", files: [] };
  try {
    index = JSON.parse(await readFile(path.join(dataDir, "index.json"), "utf8"));
  } catch {
    /* fresh data dir */
  }
  // Read every level/year file on disk, not only the indexed ones, so nothing is orphaned.
  for (const level of await readdir(dataDir, { withFileTypes: true }).catch(() => [])) {
    if (!level.isDirectory()) continue;
    for (const f of await readdir(path.join(dataDir, level.name))) {
      if (!/^\d{4}\.json$/.test(f)) continue;
      const rows = JSON.parse(await readFile(path.join(dataDir, level.name, f), "utf8")) as Policy[];
      for (const r of rows) records.set(r.id, r);
    }
  }

  return {
    get: (id) => records.get(id),
    all: () => [...records.values()],
    upsert(record, opts) {
      const prev = records.get(record.id);
      const next = mergeRecord(prev, record, opts);
      const errors = validate(next);
      if (errors.length) throw new Error(`${record.id}: ${errors.join("; ")}`);
      if (prev && sameRecord(prev, next)) return prev;
      changedIds.add(next.id);
      if (prev) touched.add(fileKey(prev));
      touched.add(fileKey(next));
      records.set(next.id, next);
      return next;
    },
    changed: () => changedIds.size,
    remove(id) {
      const prev = records.get(id);
      if (!prev) return;
      touched.add(fileKey(prev));
      records.delete(id);
    },
    async save() {
      const byFile = new Map<string, Policy[]>();
      for (const r of records.values()) {
        const k = fileKey(r);
        if (!byFile.has(k)) byFile.set(k, []);
        byFile.get(k)!.push(r);
      }
      let written = 0;
      for (const k of touched) {
        const rows = (byFile.get(k) ?? []).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
        const file = path.join(dataDir, k);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(rows, null, 2) + "\n");
        written++;
      }
      const files = [...byFile]
        .map(([k, rows]) => ({ level: rows[0].level, year: rows[0].year, path: k, count: rows.length }))
        .sort((a, b) => a.level.localeCompare(b.level) || a.year - b.year);
      // Crawled data replaces the hand-written sample, so the `sample` flag is dropped here.
      const next: IndexFile = { updatedAt: touched.size ? new Date().toISOString().slice(0, 10) : index.updatedAt, files };
      await writeFile(path.join(dataDir, "index.json"), JSON.stringify(next, null, 2) + "\n");
      touched.clear();
      index = next;
      return written;
    },
  };
}
