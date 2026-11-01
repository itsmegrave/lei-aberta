import type { Level, Policy } from "./types";
import { currentName, isNoPartyCode } from "./parties.ts";
import { area, SEARCH_ALIASES, STATE_NAMES } from "./vocab.ts";

const UF_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([uf, name]) => [name, uf]));

/** State (UF) a state or municipal law belongs to, e.g. "São Paulo" -> SP, "Campinas (SP)" -> SP. Federal laws have none. */
export function lawState(p: Pick<Policy, "level" | "jurisdiction">): string {
  if (p.level === "federal") return "";
  const j = p.jurisdiction.trim();
  const code = j.match(/\(([A-Z]{2})\)$/)?.[1] ?? (STATE_NAMES[j] ? j : UF_BY_NAME.get(j));
  return code && STATE_NAMES[code] ? code : "";
}

export const NO_PARTY = "Sem partido";
export const UNKNOWN_PARTY = "Partido não identificado";
export const EXECUTIVE_AUTHOR = "Poder Executivo";

/** Authors that are institutions, not people with a party. */
const INSTITUTION: Record<string, string> = {
  executive: EXECUTIVE_AUTHOR,
  committee: "Comissão",
  judiciary: "Poder Judiciário",
  prosecution: "Ministério Público",
  other: "Outra autoria",
};

/**
 * Chart bucket for a party code: the party's current name (PMDB -> MDB, PFL -> União Brasil), so a party's history
 * counts under one name. The record keeps the party at authorship; only charts and filters use this.
 */
export function partyBucket(code: string | null | undefined, year: number, missing: string): string {
  if (!code || isNoPartyCode(code)) return code ? NO_PARTY : missing;
  return currentName(code, year);
}

/**
 * Buckets for the "author party" chart. Institutions get their own bucket, never a party.
 * A lawmaker whose party at authorship could not be established is "não identificado", not "sem partido".
 */
export function authorKeys(p: Policy): string[] {
  const keys = new Set<string>();
  for (const a of p.authors) {
    if (INSTITUTION[a.kind]) keys.add(INSTITUTION[a.kind]);
    else keys.add(partyBucket(a.party, p.year, UNKNOWN_PARTY));
  }
  return keys.size ? [...keys] : [UNKNOWN_PARTY];
}

/** Bucket for the "executive party" chart: party of whoever signed the law, by its current name. */
export function executiveKey(p: Policy): string {
  return partyBucket(p.executive?.party, p.year, NO_PARTY);
}

/**
 * What the home page needs to filter, chart and search one law, without its text.
 * The catalog can reach tens of thousands of laws, so the browser gets these rows (see lib/listing.ts)
 * and loads the full cards only one page at a time.
 */
export interface Row {
  /** Position in the catalog order (newest first); the page file that holds the card is pos / PAGE_SIZE. */
  pos: number;
  level: Level;
  year: number;
  areas: string[];
  /** authorKeys(): parties and institutions, never the executive's party. */
  authors: string[];
  /** executiveKey(). */
  executive: string;
  /** States of the proposing lawmakers. */
  ufs: string[];
  /** lawState(): the state of a state or municipal law, "" for federal. */
  state: string;
  /** Has at least one official source link. */
  official: boolean;
  /** Normalized search text: title, number and author names. */
  text: string;
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function toRow(p: Policy, pos = 0): Row {
  return {
    pos,
    level: p.level,
    year: p.year,
    areas: p.areas,
    authors: authorKeys(p),
    executive: executiveKey(p),
    ufs: [...new Set(p.authors.map((a) => a.uf).filter((u): u is string => Boolean(u)))],
    state: lawState(p),
    official: p.sources.length > 0,
    text: normalize([p.title, p.number ?? "", ...p.authors.map((a) => a.name)].join(" ")),
  };
}

export interface Filters {
  q: string;
  level: Level | "";
  area: string;
  author: string;
  executive: string;
  /** State (UF): the state of a state or municipal law, or of a proposing lawmaker. */
  uf: string;
  year: number | null;
}

export const EMPTY_FILTERS: Filters = { q: "", level: "", area: "", author: "", executive: "", uf: "", year: null };

export const isFiltered = (f: Filters) => Boolean(f.q.trim() || f.level || f.area || f.author || f.executive || f.uf || f.year != null);

/** Applies all filters except `skip`, so a chart can show every option of its own dimension. */
export function applyFilters(rows: Row[], f: Filters, skip?: keyof Filters): Row[] {
  const q = normalize(f.q.trim());
  const terms = (SEARCH_ALIASES[q] ?? q).split(/\s+/).filter(Boolean);
  return rows.filter(
    (r) =>
      (!q || matches(r, q, terms)) &&
      (skip === "level" || !f.level || r.level === f.level) &&
      (skip === "area" || !f.area || r.areas.includes(f.area)) &&
      (skip === "author" || !f.author || r.authors.includes(f.author)) &&
      (skip === "executive" || !f.executive || r.executive === f.executive) &&
      (skip === "year" || f.year == null || r.year === f.year) &&
      (skip === "uf" || !f.uf || r.state === f.uf || r.ufs.includes(f.uf)),
  );
}

const areaText = new Map<string, string>();
function matches(r: Row, q: string, terms: string[]): boolean {
  const topics = r.areas.map((a) => {
    if (!areaText.has(a)) areaText.set(a, normalize(`${a} ${area(a).label}`));
    return areaText.get(a)!;
  });
  const hay = topics.length ? `${r.text} ${topics.join(" ")}` : r.text;
  return hay.includes(q) || terms.every((t) => hay.includes(t));
}

/** Laws per proposing lawmaker's state. Executive bills have no state and are left out. */
export function perAuthorState(rows: Row[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) for (const uf of r.ufs) m.set(uf, (m.get(uf) ?? 0) + 1);
  return m;
}

/** Counts rows per key, sorted by count then name. A row may count in several keys. */
export function countBy<T>(rows: T[], keys: (r: T) => string | string[]): { key: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const k of ([] as string[]).concat(keys(r))) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "pt"));
}

export type YearRow = { year: number; federal: number; estadual: number; municipal: number };

/** One row per year from 1988 to `lastYear`, so empty years read as gaps. */
export function perYear(rows: Pick<Row, "year" | "level">[], lastYear: number): YearRow[] {
  const out: YearRow[] = [];
  for (let y = 1988; y <= lastYear; y++) out.push({ year: y, federal: 0, estadual: 0, municipal: 0 });
  for (const r of rows) if (r.year >= 1988 && r.year <= lastYear) out[r.year - 1988][r.level] += 1;
  return out;
}

type Count = { key: string; value: number };

/** Everything the home page's numbers and charts show for one set of filters. */
export interface Overview {
  /** Number of matching laws. */
  total: number;
  minYear: number | null;
  maxYear: number | null;
  themes: number;
  officialPct: number;
  /** Each chart ignores its own filter, so it keeps showing every option. */
  topics: Count[];
  levels: Count[];
  years: YearRow[];
  author: Count[];
  executive: Count[];
  ufs: [string, number][];
}

export function overview(rows: Row[], f: Filters, lastYear: number): { overview: Overview; matches: Row[] } {
  const view = (skip?: keyof Filters) => applyFilters(rows, f, skip);
  const matches = view();
  let minYear: number | null = null;
  let maxYear: number | null = null;
  for (const r of matches) {
    if (minYear == null || r.year < minYear) minYear = r.year;
    if (maxYear == null || r.year > maxYear) maxYear = r.year;
  }
  return {
    matches,
    overview: {
      total: matches.length,
      minYear,
      maxYear,
      themes: new Set(matches.flatMap((r) => r.areas)).size,
      officialPct: matches.length ? Math.round((100 * matches.filter((r) => r.official).length) / matches.length) : 0,
      topics: countBy(view("area"), (r) => r.areas),
      levels: countBy(view("level"), (r) => r.level),
      years: perYear(view("year"), lastYear),
      author: countBy(view("author"), (r) => r.authors),
      executive: countBy(view("executive"), (r) => r.executive),
      ufs: [...perAuthorState(view("uf"))],
    },
  };
}
