/**
 * Municipal laws from Diários Oficiais municipais, via the Querido Diário API (Open Knowledge Brasil).
 *
 * Querido Diário collects each city's official gazette and exposes its text. Gazettes are not
 * structured, so we read the plain text and pick out law headings such as
 * "LEI Nº 18.123, DE 10 DE OUTUBRO DE 2024" followed by the ementa.
 *
 * Mayors' parties need TSE election data and are not set here: `executive` stays null.
 * Authors (vereador or prefeito) are rarely stated in the published law, so `authors` stays empty.
 */
import type { Policy } from "../../lib/types.ts";
import { fetchJson, fetchText, mapLimit } from "./http.ts";
import { portalSource } from "./portals.ts";
import { bareNumber, capSummary, isoDate, shortTitle } from "./text.ts";

export const API = "https://api.queridodiario.ok.org.br";

/** IBGE codes of the 26 state capitals (Brasília is the Distrito Federal, not a município). */
export const CAPITALS: Record<string, string> = {
  "1100205": "Porto Velho", "1200401": "Rio Branco", "1302603": "Manaus", "1400100": "Boa Vista",
  "1501402": "Belém", "1600303": "Macapá", "1721000": "Palmas", "2111300": "São Luís",
  "2211001": "Teresina", "2304400": "Fortaleza", "2408102": "Natal", "2507507": "João Pessoa",
  "2611606": "Recife", "2704302": "Maceió", "2800308": "Aracaju", "2927408": "Salvador",
  "3106200": "Belo Horizonte", "3205309": "Vitória", "3304557": "Rio de Janeiro", "3550308": "São Paulo",
  "4106902": "Curitiba", "4205407": "Florianópolis", "4314902": "Porto Alegre", "5002704": "Campo Grande",
  "5103403": "Cuiabá", "5208707": "Goiânia",
};

export interface Gazette {
  territory_id: string;
  territory_name: string;
  state_code: string;
  date: string;
  edition?: string | null;
  is_extra_edition?: boolean;
  url: string;
  txt_url?: string | null;
}

interface GazettesPage {
  total_gazettes: number;
  gazettes: Gazette[];
}

export type MunicipalType = "lei" | "lei-complementar";

export interface MunicipalLaw {
  type: MunicipalType;
  number: string;
  date: string;
  ementa: string;
}

/**
 * Law heading at the start of a line, in capitals: "LEI Nº 1.234, DE 5 DE MARÇO DE 2024",
 * "LEI COMPLEMENTAR Nº 12/2024, DE 5 DE MARÇO DE 2024", "LEI MUNICIPAL Nº 1.234 DE 05 DE MARÇO DE 2024".
 * Case-sensitive on purpose: citations inside a text are written "Lei nº ..., de 5 de março de ...".
 */
const HEADING =
  /(^|\n)[ \t]*(PROJETO DE |AUTÓGRAFO DE |AUTOGRAFO DE |MENSAGEM .{0,40})?LEI (COMPLEMENTAR )?(?:MUNICIPAL )?N[º°ºO.]*\s*([\d.]+)(?:\s*\/\s*\d{2,4})?\s*,?\s*(?:DE\s+)?(\d{1,2})[º°O]?\s+DE\s+([A-ZÇ]+)\s+DE\s+(\d{4})/g;

/** Where an ementa ends: the enacting clause or the first article. */
const EMENTA_END =
  /\s(?:O|A)\s+(?:PREFEITO|PREFEITA|PRESIDENTE|C[ÂA]MARA)\b|\s(?:Fa[çc]o saber|FA[ÇC]O SABER|O Prefeito|A Prefeita|A C[âa]mara Municipal|O Povo)\b|\sArt\.?\s*1|\sARTIGO\s+1|\sCAP[ÍI]TULO\s+I\b/;

/** Finds law headings and their ementas in a gazette's text. Only laws signed in `minYear` or later are kept. */
export function extractLaws(text: string, minYear: number): MunicipalLaw[] {
  const out = new Map<string, MunicipalLaw>();
  for (const m of text.matchAll(HEADING)) {
    if (m[2]) continue; // bills, autógrafos and messages are not enacted laws
    const date = isoDate(m[5], m[6], m[7]);
    if (!date || Number(m[7]) < minYear) continue;
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 1500).replace(/\s+/g, " ");
    const end = after.search(EMENTA_END);
    const ementa = (end >= 0 ? after.slice(0, end) : after.slice(0, 500)).replace(/^[\s.,;:–-]+/, "").trim();
    if (ementa.length < 15 || ementa.length > 800) continue;
    const law: MunicipalLaw = { type: m[3] ? "lei-complementar" : "lei", number: m[4].replace(/\.$/, ""), date, ementa };
    const key = `${law.type}-${bareNumber(law.number)}-${date.slice(0, 4)}`;
    if (!out.has(key)) out.set(key, law);
  }
  return [...out.values()];
}

export function municipalId(territoryId: string, law: Pick<MunicipalLaw, "type" | "number" | "date">): string {
  const prefix = law.type === "lei-complementar" ? "lc" : "lei";
  return `municipal-${territoryId}-${prefix}-${bareNumber(law.number)}-${law.date.slice(0, 4)}`;
}

/** `official` is the city's own portal (see portals.ts); the Querido Diário copy alone is not an official domain. */
export function toRecord(g: Gazette, law: MunicipalLaw, official: { label: string; url: string } | null = null): Policy {
  const [y, m, d] = g.date.split("-");
  const edition = g.edition ? ` nº ${g.edition}` : "";
  return {
    id: municipalId(g.territory_id, law),
    level: "municipal",
    jurisdiction: `${g.territory_name} (${g.state_code})`,
    type: law.type,
    number: law.number,
    title: shortTitle(law.ementa),
    summary: capSummary(law.ementa),
    year: Number(law.date.slice(0, 4)),
    presentedAt: null,
    status: "sancionada",
    areas: [],
    authors: [],
    parties: [],
    executive: null,
    sources: [
      {
        label: `Diário Oficial de ${g.territory_name}${edition}, ${d}/${m}/${y}${g.is_extra_edition ? " (edição extra)" : ""}`,
        url: g.url,
      },
      ...(official ? [official] : []),
    ],
  };
}

export function gazettesUrl(territories: string[], since: string, until: string, offset: number, size = 100): string {
  const q = new URLSearchParams({ published_since: since, published_until: until, offset: String(offset), size: String(size), sort_by: "ascending_date" });
  for (const t of territories) q.append("territory_ids", t);
  return `${API}/gazettes?${q}`;
}

export interface QdOptions {
  /** IBGE codes. Empty means every city Querido Diário covers. */
  territories: string[];
  since: string;
  until: string;
  /** Upper bound on gazette texts downloaded per run. */
  maxGazettes?: number;
  concurrency?: number;
  log?: (msg: string) => void;
}

export async function crawlQueridoDiario(opts: QdOptions): Promise<{ records: Policy[]; errors: string[] }> {
  const { territories, since, until, maxGazettes = 400, concurrency = 4, log = console.log } = opts;
  const errors: string[] = [];
  const gazettes: Gazette[] = [];

  // The API filters by a list of territories; batch to keep URLs short.
  const batches = territories.length ? chunk(territories, 10) : [[]];
  for (const batch of batches) {
    for (let offset = 0; gazettes.length < maxGazettes; offset += 100) {
      let page: GazettesPage;
      try {
        page = await fetchJson<GazettesPage>(gazettesUrl(batch, since, until, offset));
      } catch (err) {
        errors.push(`gazettes ${batch.join(",") || "all"} offset ${offset}: ${String(err)}`);
        break;
      }
      gazettes.push(...page.gazettes.filter((g) => g.txt_url));
      if (page.gazettes.length < 100 || offset + 100 >= page.total_gazettes) break;
    }
  }
  const picked = gazettes.slice(0, maxGazettes);
  log(`Querido Diário: ${picked.length} gazette(s) with text from ${since} to ${until}${gazettes.length > maxGazettes ? ` (capped from ${gazettes.length})` : ""}`);

  // Only cities whose official portal answers today get records: every record needs an official link.
  const cities = [...new Map(picked.map((g) => [g.territory_id, g.territory_name])).entries()];
  const official = new Map<string, { label: string; url: string }>();
  await mapLimit(cities, concurrency, async ([id, name]) => {
    const src = portalSource(id, name);
    if (src && (await isUp(src.url))) official.set(id, src);
    else errors.push(`${name} (${id}): no reachable official portal, gazettes skipped`);
  });

  const minYear = Number(since.slice(0, 4)) - 1;
  const perGazette = await mapLimit(picked.filter((g) => official.has(g.territory_id)), concurrency, async (g) => {
    try {
      return extractLaws(await fetchText(g.txt_url!, { timeoutMs: 60_000 }), minYear).map((law) => toRecord(g, law, official.get(g.territory_id)!));
    } catch (err) {
      errors.push(`${g.txt_url}: ${String(err)}`);
      return [];
    }
  });
  return { records: perGazette.flat(), errors };
}

async function isUp(url: string): Promise<boolean> {
  try {
    await fetchText(url, { retries: 1, timeoutMs: 20_000 });
    return true;
  } catch {
    return false;
  }
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
