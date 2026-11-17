import type { Policy } from "./types";

/** Where a law applies, as map data: the states to highlight and a short sentence that says it. */
export interface LawPlace {
  /** "country" for federal laws (every state), "state" for state and municipal laws. */
  scope: "country" | "state";
  /** The state the law applies in (state and municipal laws). */
  uf: string | null;
  /** States of the lawmakers who proposed it, deduplicated. Shown on federal laws only. */
  authorUfs: string[];
  /** Plain sentence for the map, e.g. "Vale em todo o Brasil." */
  text: string;
}

/**
 * Finds the state a law applies in. State law ids carry the UF (`estadual-<uf>-...`) and their
 * jurisdiction is the state name; municipal jurisdictions read "City (UF)".
 */
export function lawPlace(p: Pick<Policy, "id" | "level" | "jurisdiction" | "authors">, names: Record<string, string>): LawPlace {
  const valid = (uf: string | null | undefined) => (uf && names[uf.toUpperCase()] ? uf.toUpperCase() : null);
  if (p.level === "federal") {
    const authorUfs = [...new Set(p.authors.map((a) => valid(a.uf)).filter((u): u is string => !!u))];
    return { scope: "country", uf: null, authorUfs, text: "Lei federal: vale em todo o Brasil." };
  }
  const byName = Object.keys(names).find((u) => names[u].localeCompare(p.jurisdiction.trim(), "pt-BR", { sensitivity: "base" }) === 0);
  const uf = valid(p.id.match(/^estadual-([a-z]{2})-/i)?.[1]) ?? valid(p.jurisdiction.match(/\(([A-Za-z]{2})\)\s*$/)?.[1]) ?? byName ?? null;
  const state = uf ? names[uf] : null;
  if (p.level === "estadual") return { scope: "state", uf, authorUfs: [], text: state ? `Lei estadual: vale em ${state}.` : `Lei estadual: vale em ${p.jurisdiction}.` };
  const city = p.jurisdiction.replace(/\s*\([A-Za-z]{2}\)\s*$/, "");
  return { scope: "state", uf, authorUfs: [], text: state ? `Lei municipal: vale em ${city}, ${state}.` : `Lei municipal: vale em ${p.jurisdiction}.` };
}
