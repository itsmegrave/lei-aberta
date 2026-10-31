import { authorKeys, countBy, executiveKey } from "./catalog.ts";
import { partyOf, PARTIES, type Party } from "./parties.ts";
import type { Policy } from "./types";

/** What a party page shows from the catalog. Author party and executive party stay separate. */
export interface PartyStats {
  slug: string;
  /** Laws with at least one author from this party (by its current name). */
  proposed: number;
  /** Laws signed by a president, governor or mayor of this party. */
  signed: number;
  /** One row per year from 1988 to lastYear. */
  years: { year: number; proposed: number; signed: number }[];
  /** Topics of the laws it proposed, by count. */
  topics: { key: string; value: number }[];
  /** Codes as they appear in the records (PMDB, MDB...), with counts, newest use first. */
  codes: { code: string; proposed: number; signed: number; first: number; last: number }[];
  /** Newest laws it proposed or signed (ids). */
  recent: string[];
}

export function partyStats(policies: Policy[], lastYear: number, recentCount = 9): Map<string, PartyStats> {
  const out = new Map<string, PartyStats>();
  const codeMaps = new Map<string, Map<string, PartyStats["codes"][number]>>();
  for (const p of PARTIES) {
    out.set(p.slug, {
      slug: p.slug,
      proposed: 0,
      signed: 0,
      years: Array.from({ length: Math.max(0, lastYear - 1987) }, (_, i) => ({ year: 1988 + i, proposed: 0, signed: 0 })),
      topics: [],
      codes: [],
      recent: [],
    });
    codeMaps.set(p.slug, new Map());
  }
  const topicRows = new Map<string, Policy[]>();
  // Newest first, so `recent` fills with the latest laws.
  const sorted = [...policies].sort((a, b) => b.year - a.year || (b.signedAt ?? "").localeCompare(a.signedAt ?? "") || a.id.localeCompare(b.id));
  for (const law of sorted) {
    const authorNames = new Set(authorKeys(law));
    const execName = executiveKey(law);
    for (const party of PARTIES) {
      const proposed = authorNames.has(party.short);
      const signed = execName === party.short;
      if (!proposed && !signed) continue;
      const s = out.get(party.slug)!;
      const y = s.years[law.year - 1988];
      if (proposed) {
        s.proposed++;
        if (y) y.proposed++;
        if (!topicRows.has(party.slug)) topicRows.set(party.slug, []);
        topicRows.get(party.slug)!.push(law);
      }
      if (signed) {
        s.signed++;
        if (y) y.signed++;
      }
      if (s.recent.length < recentCount) s.recent.push(law.id);
      const codes = codeMaps.get(party.slug)!;
      const seen = new Set<string>();
      const bump = (code: string, k: "proposed" | "signed") => {
        if (seen.has(k + code)) return;
        seen.add(k + code);
        const c = codes.get(code) ?? { code, proposed: 0, signed: 0, first: law.year, last: law.year };
        c[k]++;
        c.first = Math.min(c.first, law.year);
        c.last = Math.max(c.last, law.year);
        codes.set(code, c);
      };
      if (proposed) for (const a of law.authors) if (a.party && partyOf(a.party, law.year)?.slug === party.slug) bump(a.party, "proposed");
      if (signed && law.executive?.party) bump(law.executive.party, "signed");
    }
  }
  for (const party of PARTIES) {
    const s = out.get(party.slug)!;
    s.topics = countBy(topicRows.get(party.slug) ?? [], (l) => l.areas);
    s.codes = [...codeMaps.get(party.slug)!.values()].sort((a, b) => b.last - a.last || b.proposed + b.signed - (a.proposed + a.signed));
  }
  return out;
}

/** Directory order: by laws in the catalog (proposed + signed), then by name. Never by position. */
export function directoryOrder(stats: Map<string, PartyStats>): Party[] {
  const total = (p: Party) => (stats.get(p.slug)?.proposed ?? 0) + (stats.get(p.slug)?.signed ?? 0);
  return [...PARTIES].sort((a, b) => total(b) - total(a) || a.short.localeCompare(b.short, "pt"));
}
