import { EMPTY_FILTERS, type Filters, type Row } from "./catalog.ts";
import { currentName } from "./parties.ts";
import { shortUrl } from "./share.ts";
import type { Level, Policy } from "./types";

/**
 * How the home page loads a large catalog.
 *
 * The build writes static files under /dados/ (app/dados/[file]/route.ts):
 *   - pagina-<n>.json: the full cards of page n, in catalog order (newest first), PAGE_SIZE per file.
 *   - indice.json: one compact Row per law, fetched only once someone filters or searches.
 * The page itself ships page 1 and the unfiltered numbers, so it renders without any fetch.
 */
export const PAGE_SIZE = 10;

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
export const pageFile = (page: number) => `pagina-${page}.json`;
/** Page file (1-based) that holds the law at catalog position `pos`. */
export const pageOfPos = (pos: number) => Math.floor(pos / PAGE_SIZE) + 1;

/** Card payload: what the card and the detail sheet show, plus the law's short link. */
export function toCard(p: Policy): Policy {
  const { presentedAt: _p, reissues: _r, curated: _c, ...rest } = p;
  return { ...rest, presentedAt: null, shareUrl: shortUrl(p.id) };
}

/** Compact index: strings go in one table, rows refer to them by number. */
export interface IndexFile {
  v: 1;
  strings: string[];
  /** [level, year, areas, authors, executive, ufs, official (0/1), text] */
  rows: [number, number, number[], number[], number, number[], 0 | 1, string][];
}

export function encodeIndex(rows: Row[]): IndexFile {
  const strings: string[] = [];
  const ids = new Map<string, number>();
  const id = (s: string) => {
    let n = ids.get(s);
    if (n == null) ids.set(s, (n = strings.push(s) - 1));
    return n;
  };
  return {
    v: 1,
    strings,
    rows: rows.map((r) => [id(r.level), r.year, r.areas.map(id), r.authors.map(id), id(r.executive), r.ufs.map(id), r.official ? 1 : 0, r.text]),
  };
}

export function decodeIndex(file: IndexFile): Row[] {
  const s = file.strings;
  return file.rows.map(([level, year, areas, authors, executive, ufs, official, text], pos) => ({
    pos,
    level: s[level] as Level,
    year,
    areas: areas.map((i) => s[i]),
    authors: authors.map((i) => s[i]),
    executive: s[executive],
    ufs: ufs.map((i) => s[i]),
    official: official === 1,
    text,
  }));
}

/** Filters and page in the address bar, in Portuguese, so a filtered page can be shared. */
const PARAMS: [keyof Filters, string][] = [
  ["q", "q"],
  ["level", "nivel"],
  ["area", "tema"],
  ["author", "autor"],
  ["executive", "executivo"],
  ["uf", "uf"],
  ["year", "ano"],
];

export function readUrlState(search: string): { filters: Filters; page: number } {
  const sp = new URLSearchParams(search);
  const filters: Filters = { ...EMPTY_FILTERS };
  for (const [key, name] of PARAMS) {
    const v = sp.get(name)?.trim();
    if (!v) continue;
    if (key === "year") {
      const y = Number(v);
      if (Number.isInteger(y)) filters.year = y;
    } else if (key === "level") {
      if (v === "federal" || v === "estadual" || v === "municipal") filters.level = v;
    } else if (key === "author" || key === "executive") {
      // Links made before charts used current names (?autor=PMDB) still land on the same party.
      filters[key] = currentName(v);
    } else filters[key] = v;
  }
  const page = Number(sp.get("pagina"));
  return { filters, page: Number.isInteger(page) && page > 1 ? page : 1 };
}

export function writeUrlState(filters: Filters, page: number): string {
  const sp = new URLSearchParams();
  for (const [key, name] of PARAMS) {
    const v = filters[key];
    if (v != null && String(v).trim() !== "") sp.set(name, String(v).trim());
  }
  if (page > 1) sp.set("pagina", String(page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** The search page: where every filter, search and law list lives. The home only links into it. */
export const SEARCH_PATH = "/busca";

/** Link to the search page with these filters, on page 1. */
export function searchHref(filters: Partial<Filters> = {}): string {
  return SEARCH_PATH + writeUrlState({ ...EMPTY_FILTERS, ...filters }, 1);
}

/** Page numbers to show: first, last, and two around the current one, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev === 2) out.push(n - 1);
    else if (n - prev > 2) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
