import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq, max } from "drizzle-orm";
import { getDb } from "./db/client";
import { fromDbRow } from "./db/codec";
import { policies, policyColumns } from "./db/schema";
import { EMPTY_FILTERS, overview, toRow, type Overview, type Row } from "./catalog";
import { encodeIndex, PAGE_SIZE, pageCount, toCard, type IndexFile as RowIndex } from "./listing";
import { partyStats, type PartyStats } from "./party-stats";
import type { Policy } from "./types";

interface IndexFile {
  updatedAt: string;
  sample?: boolean;
  files: { level: string; year: number; path: string; count: number }[];
}

const DATA_DIR = path.join(process.cwd(), "data");

/** Postgres when DATABASE_URL is set (Vercel, CI), otherwise the JSON files in data/ (local dev without a database). */
const useDb = () => Boolean(process.env.DATABASE_URL);

/** Every law. Read once per build: the home page, every /dados/ file and the sitemaps share it. */
export function loadCatalog(): Promise<Catalog> {
  return (catalog ??= useDb() ? readCatalogDb() : readCatalog());
}

type Catalog = { policies: Policy[]; updatedAt: string; sample: boolean };
let catalog: Promise<Catalog> | undefined;

/** One law by id, for pages rendered on request: a single indexed lookup instead of loading the catalog. */
export async function findPolicy(id: string): Promise<Policy | undefined> {
  if (!useDb()) return (await loadCatalog()).policies.find((p) => p.id === id);
  const db = getDb();
  const [row] = await db.select(policyColumns).from(policies).where(eq(policies.id, id)).limit(1);
  return row ? fromDbRow(row) : undefined;
}

/** Every law id, for resolving short links. */
export async function policyIds(): Promise<string[]> {
  if (!useDb()) return (await loadCatalog()).policies.map((p) => p.id);
  const rows = await getDb().select({ id: policies.id }).from(policies);
  return rows.map((r) => r.id);
}

async function readCatalogDb(): Promise<Catalog> {
  const db = getDb();
  const [rows, [last]] = await Promise.all([
    db.select(policyColumns).from(policies).orderBy(desc(policies.year)),
    db.select({ at: max(policies.updatedAt) }).from(policies),
  ]);
  const list = rows.map(fromDbRow).sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "pt"));
  return { policies: list, updatedAt: (last?.at ?? new Date()).toISOString(), sample: false };
}

async function readCatalog(): Promise<Catalog> {
  const index = JSON.parse(await readFile(path.join(DATA_DIR, "index.json"), "utf8")) as IndexFile;
  const chunks = await Promise.all(
    index.files.map(async (f) => JSON.parse(await readFile(path.join(DATA_DIR, f.path), "utf8")) as Policy[]),
  );
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
