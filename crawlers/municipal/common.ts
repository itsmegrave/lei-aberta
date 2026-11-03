/** Helpers shared by the municipal adapters: law types, ids and the Policy record shape. */
import type { Author, Executive, Policy } from "../../lib/types.ts";
import { bareNumber, capSummary, clean, displayNumber, fold, shortTitle, tameCaps } from "../estadual/common.ts";
import { partyNameAt } from "../federal/politics.ts";
import type { City } from "./cities.ts";

export { bareNumber, fold };

/**
 * The municipal law types we collect. Ids use the same scheme as the Diários Oficiais crawler
 * (`municipal-<IBGE>-<lei|lc>-<n>-<year>`), so a law found in both places is one record.
 * Emendas à Lei Orgânica, decrees and resolutions are out of scope for now.
 */
export type MunicipalLawType = "lei" | "lei-complementar";

export const TYPE_LABEL: Record<MunicipalLawType, string> = { lei: "Lei", "lei-complementar": "Lei Complementar" };

/**
 * Maps a câmara's own type name to one of our types, or null for anything else.
 * Only the name is used: some câmaras set wrong LexML equivalents (João Pessoa files "Resolução" as "lei").
 * "Lei Promulgada" (promulgated by the câmara after a veto is overridden) and "Lei de Diretrizes Orçamentárias"
 * are ordinary laws with numbers in the same series; the Lei Orgânica itself is not.
 */
export function municipalLawType(description: string): MunicipalLawType | null {
  const d = fold(description).replace(/\s+/g, " ");
  if (!/^lei\b/.test(d) || /^lei organica\b/.test(d) || /^lei delegada\b/.test(d)) return null;
  if (/^lei complementar\b/.test(d)) return "lei-complementar";
  return "lei";
}

export function municipalId(ibge: string, type: MunicipalLawType, number: string, year: number): string {
  return `municipal-${ibge}-${type === "lei-complementar" ? "lc" : "lei"}-${number}-${year}`;
}

export const jurisdiction = (c: Pick<City, "name" | "uf">) => `${c.name} (${c.uf})`;

/**
 * Câmaras type party acronyms by hand ("REP", "REPUB", "REPUBLICA", "Republicanos"; "UNIAO", "UNIÃO BRASIL").
 * These spellings map to one name, then `partyNameAt` turns a current name back into the one in use on `date`
 * (a câmara that relabelled a 2015 affiliation "REPUBLICANOS" gets "PRB"). Unknown acronyms pass through.
 */
const SPELLINGS: Record<string, string> = {
  rep: "Republicanos", repub: "Republicanos", republica: "Republicanos", republicanos: "Republicanos",
  uniao: "UNIÃO", "uniao brasil": "UNIÃO", cidadania: "Cidadania", avante: "Avante", agir: "Agir",
  patri: "Patriota", patriota: "Patriota", podemos: "PODE", progressistas: "Progressistas",
  "pt do b": "PTdoB", ptdob: "PTdoB", pcdob: "PCdoB", "pc do b": "PCdoB", sdd: "SD", solidariedade: "SD",
  democrata: "Democrata", mobiliza: "Mobiliza",
};
const NO_PARTY = /^(sem ?partid\w*|s\/? ?partido|s\.part\.?|-|\/)$/;

export function normalizeParty(sigla: string | null | undefined, date: string | null): string | null {
  const s = sigla?.trim();
  if (!s || NO_PARTY.test(fold(s))) return null;
  return partyNameAt(SPELLINGS[fold(s).replace(/\s+/g, " ")] ?? s, date);
}

/** "ADOLFO QUINTAS" -> "Adolfo Quintas"; names already in mixed case are kept. */
export function titleCase(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase()) return t;
  return t
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((w, i) => (i > 0 && /^(da|de|do|das|dos|e)$/.test(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}

/**
 * Some câmaras wrap the ementa in quotes, or start it with the law's own heading
 * ("LEI COMPLEMENTAR N° 364 DE 19 DE MAIO DE 2026 \"Institui...\"", Rio Branco).
 */
export const tidyEmenta = (s: string) =>
  s
    .trim()
    .replace(/^LEI\s+(COMPLEMENTAR\s+)?(MUNICIPAL\s+)?N[º°o.]*\s*[\d.]+(\/\d{2,4})?,?\s*(DE\s+)?\d{1,2}[º°]?\s+DE\s+\S+\s+DE\s+\d{4}[.,:\s–-]*/i, "")
    .replace(/^["“”']+\s*/, "")
    .replace(/\s*["“”']+\.?$/, "");

/** "Vereador Dr. Fulano" -> "Dr. Fulano": the kind already says vereador. */
const dropOffice = (name: string) => name.replace(/^vereador(a)?\s+/i, "");

export interface DraftLaw {
  city: City;
  type: MunicipalLawType;
  /** Bare number, e.g. "11701" or "123-a". */
  number: string;
  year: number;
  /** Date the law was signed or published, YYYY-MM-DD. */
  date: string | null;
  ementa: string;
  presentedAt?: string | null;
  bill?: string | null;
  authors?: Author[];
  executive?: Executive | null;
  sources: Policy["sources"];
}

/** Builds the record. `executive` (the mayor) is set by run.ts from TSE data, never from author data. */
export function toPolicy(d: DraftLaw): Policy {
  const ementa = tameCaps(tidyEmenta(clean(d.ementa)));
  const label = `${TYPE_LABEL[d.type]} nº ${displayNumber(d.number)}/${d.year}`;
  const authors = (d.authors ?? []).map((a) => ({ ...a, name: titleCase(dropOffice(a.name)) }));
  const parties = [...new Set(authors.filter((a) => a.kind !== "executive" && a.party).map((a) => a.party!))].sort();
  return {
    id: municipalId(d.city.ibge, d.type, d.number, d.year),
    level: "municipal",
    jurisdiction: jurisdiction(d.city),
    type: d.type,
    number: displayNumber(d.number),
    title: ementa ? shortTitle(ementa) : label,
    summary: ementa ? capSummary(ementa) : label,
    year: d.year,
    presentedAt: d.presentedAt ?? null,
    status: "sancionada",
    areas: [],
    authors,
    parties,
    executive: d.executive ?? null,
    sources: d.sources,
    signedAt: d.date,
    bill: d.bill ? clean(d.bill) : null,
  };
}

export interface AdapterResult {
  records: Policy[];
  errors: string[];
  info?: string[];
}
