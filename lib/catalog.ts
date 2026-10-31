import type { Level, Policy } from "./types";
import { area, SEARCH_ALIASES } from "./vocab.ts";

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
 * Buckets for the "author party" chart. Institutions get their own bucket, never a party.
 * A lawmaker whose party at authorship could not be established is "não identificado", not "sem partido".
 */
export function authorKeys(p: Policy): string[] {
  const keys = new Set<string>();
  for (const a of p.authors) {
    if (INSTITUTION[a.kind]) keys.add(INSTITUTION[a.kind]);
    else keys.add(a.party || UNKNOWN_PARTY);
  }
  return keys.size ? [...keys] : [UNKNOWN_PARTY];
}

/** Bucket for the "executive party" chart: party of whoever signed the law. */
export function executiveKey(p: Policy): string {
  return p.executive?.party || NO_PARTY;
}

export interface Filters {
  q: string;
  level: Level | "";
  area: string;
  author: string;
  executive: string;
  /** State (UF) of a proposing lawmaker. */
  uf: string;
  year: number | null;
}

export const EMPTY_FILTERS: Filters = { q: "", level: "", area: "", author: "", executive: "", uf: "", year: null };

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Applies all filters except `skip`, so a chart can show every option of its own dimension. */
export function applyFilters(rows: Policy[], f: Filters, skip?: keyof Filters): Policy[] {
  const q = normalize(f.q.trim());
  const terms = (SEARCH_ALIASES[q] ?? q).split(/\s+/).filter(Boolean);
  return rows.filter(
    (p) =>
      (!q || matches(p, q, terms)) &&
      (skip === "level" || !f.level || p.level === f.level) &&
      (skip === "area" || !f.area || p.areas.includes(f.area)) &&
      (skip === "author" || !f.author || authorKeys(p).includes(f.author)) &&
      (skip === "executive" || !f.executive || executiveKey(p) === f.executive) &&
      (skip === "year" || f.year == null || p.year === f.year) &&
      (skip === "uf" || !f.uf || p.authors.some((a) => a.uf === f.uf)),
  );
}

function matches(p: Policy, q: string, terms: string[]): boolean {
  const hay = normalize(
    [p.title, p.summary, p.number ?? "", ...p.areas.map((a) => `${a} ${area(a).label}`), ...p.authors.map((a) => a.name)].join(" "),
  );
  return hay.includes(q) || terms.every((t) => hay.includes(t));
}

/** Laws per proposing lawmaker's state. Executive bills have no state and are left out. */
export function perAuthorState(rows: Policy[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) for (const uf of new Set(r.authors.map((a) => a.uf).filter((u): u is string => Boolean(u)))) m.set(uf, (m.get(uf) ?? 0) + 1);
  return m;
}

/** Counts rows per key, sorted by count then name. A row may count in several keys. */
export function countBy(rows: Policy[], keys: (p: Policy) => string | string[]): { key: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const k of ([] as string[]).concat(keys(r))) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "pt"));
}

/** One row per year from 1988 to `lastYear`, so empty years read as gaps. */
export function perYear(rows: Policy[], lastYear: number) {
  const out: { year: number; federal: number; estadual: number; municipal: number }[] = [];
  for (let y = 1988; y <= lastYear; y++) out.push({ year: y, federal: 0, estadual: 0, municipal: 0 });
  for (const r of rows) if (r.year >= 1988 && r.year <= lastYear) out[r.year - 1988][r.level] += 1;
  return out;
}
