import "server-only";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EMPTY_FILTERS, overview, toRow, type Overview, type Row } from "./catalog.ts";
import { encodeIndex, PAGE_SIZE, pageCount, toCard, type IndexFile as RowIndex } from "./listing.ts";
import { partyStats, type PartyStats } from "./party-stats.ts";
import type { Policy } from "./types";

interface IndexFile {
  updatedAt: string;
  sample?: boolean;
  files: { level: string; year: number; path: string; count: number }[];
}

/**
 * The JSON catalog: CATALOG_DIR, else data/ when the catalog was pulled there (npm run data:pull, which the
 * Vercel build runs), else the small sample in lib/fixtures/catalog so `npm run dev` works out of the box.
 */
const DATA_DIR =
  process.env.CATALOG_DIR ??
  (existsSync(path.join(process.cwd(), "data", "index.json")) ? path.join(process.cwd(), "data") : path.join(process.cwd(), "lib", "fixtures", "catalog"));

/** Every law. Read once per build: the home page, every /dados/ file and the sitemaps share it. */
export function loadCatalog(): Promise<Catalog> {
  return (catalog ??= readCatalog());
}

type Catalog = { policies: Policy[]; updatedAt: string; sample: boolean };
let catalog: Promise<Catalog> | undefined;

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8")) as T;

/** One <level>/<year>.json file, read once per process. Missing files read as empty. */
const files = new Map<string, Promise<Policy[]>>();
function readYear(level: string, year: string): Promise<Policy[]> {
  const key = `${level}/${year}.json`;
  if (!files.has(key)) files.set(key, readJson<Policy[]>(key).catch(() => []));
  return files.get(key)!;
}

/**
 * One law by id, for pages rendered on request. Ids start with the level and carry the year
 * (federal-lei-8069-1990, estadual-sp-lei-17000-2019), so this reads one year file instead of the
 * whole catalog; anything else falls back to the full catalog.
 */
export async function findPolicy(id: string): Promise<Policy | undefined> {
  const level = id.split("-")[0];
  if (catalog || !/^[a-z]+$/.test(level)) return (await loadCatalog()).policies.find((p) => p.id === id);
  for (const year of new Set(id.match(/\b\d{4}\b/g) ?? [])) {
    const hit = (await readYear(level, year)).find((p) => p.id === id);
    if (hit) return hit;
  }
  return (await loadCatalog()).policies.find((p) => p.id === id);
}

/** Every law id, for resolving short links: ids.json (written by data:pull) when present, else the catalog. */
export async function policyIds(): Promise<string[]> {
  return (ids ??= readJson<string[]>("ids.json").catch(async () => (await loadCatalog()).policies.map((p) => p.id)));
}
let ids: Promise<string[]> | undefined;

async function readCatalog(): Promise<Catalog> {
  const index = await readJson<IndexFile>("index.json");
  const chunks = await Promise.all(index.files.map((f) => readJson<Policy[]>(f.path)));
  const policies = chunks.flat().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "pt"));
  return { policies, updatedAt: index.updatedAt, sample: Boolean(index.sample) };
}

/** Last year the charts cover: this year, or a later one if the data has it. */
export const lastYearOf = (policies: Policy[]) => policies.reduce((y, p) => Math.max(y, p.year), new Date().getFullYear());

export interface Listing {
  rows: Row[];
  pages: number;
  /** Numbers and charts with no filter, so the page renders before any fetch. */
  overview: Overview;
  lastYear: number;
  /** Cards of one page (1-based). */
  page: (n: number) => Policy[];
  index: () => RowIndex;
}

let listing: Promise<Listing & Catalog> | undefined;

/** Built once per build process and shared by the home page and every /dados/ file. */
export function loadListing(): Promise<Listing & Catalog> {
  return (listing ??= buildListing());
}

async function buildListing(): Promise<Listing & Catalog> {
  const c = await loadCatalog();
  const rows = c.policies.map((p, i) => toRow(p, i));
  const lastYear = lastYearOf(c.policies);
  let index: RowIndex | undefined;
  return {
    ...c,
    rows,
    lastYear,
    pages: pageCount(rows.length),
    overview: overview(rows, EMPTY_FILTERS, lastYear).overview,
    page: (n) => c.policies.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE).map(toCard),
    index: () => (index ??= encodeIndex(rows)),
  };
}

let parties: Promise<{ stats: Map<string, PartyStats>; byId: Map<string, Policy>; updatedAt: string }> | undefined;

/** Per-party numbers for the party pages, built once per build. */
export function loadPartyStats() {
  return (parties ??= loadCatalog().then((c) => ({
    stats: partyStats(c.policies, lastYearOf(c.policies)),
    byId: new Map(c.policies.map((p) => [p.id, p])),
    updatedAt: c.updatedAt,
  })));
}
