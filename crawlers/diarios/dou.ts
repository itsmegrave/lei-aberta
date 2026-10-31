/**
 * Diário Oficial da União (DOU), Seção 1, as published by Imprensa Nacional at in.gov.br.
 *
 * For each day we read the "leitura do jornal" page, which embeds the day's table of contents as
 * JSON, keep only federal norms we catalog (leis, leis complementares, medidas provisórias,
 * emendas constitucionais), then open each act's page to read its ementa.
 *
 * The DOU is the official publication, so every record gets the act page as a source. Records
 * are written with owner=false: the federal crawler (Senado/Câmara/Planalto) owns authors,
 * parties, executive and status, and the DOU only fills gaps and adds its source.
 */
import type { Policy } from "../../lib/types.ts";
import { describeError, fetchText, HttpError, mapLimit } from "./http.ts";
import { bareNumber, capSummary, clean, isoDate, shortTitle } from "./text.ts";

const BASE = "https://www.in.gov.br";
/** Regular Seção 1, extra edition and supplement. */
export const SECTIONS = ["do1", "do1e", "do1a"] as const;

/** One entry of the embedded table of contents. Only the fields we use. */
export interface DouItem {
  urlTitle: string;
  title?: string;
  titulo?: string;
  artType?: string;
  pubDate?: string;
  pubName?: string;
  content?: string;
  hierarchyStr?: string;
  editionNumber?: string;
  numberPage?: string;
}

export type FederalType = "lei" | "lei-complementar" | "mp" | "emenda-constitucional";

export interface ActHeader {
  type: FederalType;
  number: string;
  /** Date the act was signed, from its heading. */
  date: string;
}

const ID_PREFIX: Record<FederalType, string> = {
  lei: "lei",
  "lei-complementar": "lc",
  mp: "mp",
  "emenda-constitucional": "ec",
};

const TYPE_LABEL: Record<FederalType, string> = {
  lei: "Lei",
  "lei-complementar": "Lei Complementar",
  mp: "Medida Provisória",
  "emenda-constitucional": "Emenda Constitucional",
};

export const leituraUrl = (isoDay: string, section: string) => {
  const [y, m, d] = isoDay.split("-");
  return `${BASE}/leiturajornal?data=${d}-${m}-${y}&secao=${section}`;
};
export const actUrl = (urlTitle: string) => `${BASE}/web/dou/-/${urlTitle}`;

/** Extracts the JSON table of contents from a leiturajornal page. */
export function parseLeitura(html: string): DouItem[] {
  const m = html.match(/<script[^>]*id=["']params["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  const data = JSON.parse(m[1]) as { jsonArray?: DouItem[] };
  return Array.isArray(data.jsonArray) ? data.jsonArray.filter((i) => i && typeof i.urlTitle === "string") : [];
}

const HEADER =
  /^(LEI COMPLEMENTAR|LEI|MEDIDA PROVIS[ÓO]RIA|EMENDA CONSTITUCIONAL)\s+N[º°ºo.]*\s*([\d.]+(?:-[A-Z\d]+)?)\s*,?\s+DE\s+(\d{1,2})[º°o]?\s+DE\s+([A-ZÇÃa-zçã]+)\s+DE\s+(\d{4})/i;

/** "LEI Nº 14.973, DE 16 DE SETEMBRO DE 2024" -> { type: "lei", number: "14.973", date: "2024-09-16" }. */
export function parseHeader(title: string): ActHeader | null {
  const m = clean(title).toUpperCase().match(HEADER);
  if (!m) return null;
  const kind = m[1].replace("Ó", "O");
  const type: FederalType =
    kind === "LEI COMPLEMENTAR" ? "lei-complementar"
    : kind === "LEI" ? "lei"
    : kind === "MEDIDA PROVISORIA" ? "mp"
    : "emenda-constitucional";
  const date = isoDate(m[3], m[4], m[5]);
  return date ? { type, number: m[2], date } : null;
}

/** True for the norms we catalog; drops rectifications, vetoes, messages and everything else. */
export function isCatalogued(item: DouItem): ActHeader | null {
  const title = item.title || item.titulo || "";
  if (/retifica|errata|republica/i.test(title)) return null;
  return parseHeader(title);
}

/** Reads the ementa from an act page; falls back to the snippet in the table of contents. */
export function parseEmenta(html: string): string | null {
  const m = html.match(/<p[^>]*class=["'][^"']*\bementa\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const text = m ? clean(m[1]) : "";
  return text.length >= 10 ? text : null;
}

export function federalId(h: ActHeader): string {
  return `federal-${ID_PREFIX[h.type]}-${bareNumber(h.number)}-${h.date.slice(0, 4)}`;
}

/** "17/09/2024" -> "2024-09-17". */
function pubIso(pubDate: string | undefined, fallback: string): string {
  const m = pubDate?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : fallback;
}

export function douSourceLabel(publishedOn: string, section: string, page?: string): string {
  const [y, m, d] = publishedOn.split("-");
  const extra = section === "do1e" ? " (edição extra)" : section === "do1a" ? " (suplemento)" : "";
  return `Diário Oficial da União, ${d}/${m}/${y}, Seção 1${extra}${page ? `, p. ${page}` : ""}`;
}

/** Builds a record from a DOU act. Fields the DOU cannot know (authors of a bill, executive) are left empty for the federal crawler. */
export function toRecord(item: DouItem, header: ActHeader, ementa: string, publishedOn: string, section: string): Policy {
  const isMp = header.type === "mp";
  const summary = capSummary(ementa);
  return {
    id: federalId(header),
    level: "federal",
    jurisdiction: "Brasil",
    type: header.type,
    number: header.number,
    title: shortTitle(ementa) || `${TYPE_LABEL[header.type]} nº ${header.number}`,
    summary,
    year: Number(header.date.slice(0, 4)),
    // An MP is issued and takes effect on publication; for laws the bill date comes from the federal crawler.
    presentedAt: isMp ? header.date : null,
    status: isMp ? "em-tramitacao" : header.type === "emenda-constitucional" ? "promulgada" : "sancionada",
    areas: [],
    // MPs are always issued by the President. A law's authors come from the bill, which the DOU does not carry.
    authors: isMp ? [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }] : [],
    parties: [],
    executive: null,
    sources: [{ label: douSourceLabel(publishedOn, section, item.numberPage), url: actUrl(item.urlTitle) }],
  };
}

export interface DouResult {
  records: Policy[];
  /** Days or sections that could not be read, for the run log. */
  errors: string[];
}

/** Crawls Seção 1 for each day in `days` (YYYY-MM-DD). */
export async function crawlDou(days: string[], { concurrency = 3, log = console.log } = {}): Promise<DouResult> {
  const errors: string[] = [];
  const found: { item: DouItem; header: ActHeader; day: string; section: string }[] = [];

  for (const day of days) {
    for (const section of SECTIONS) {
      try {
        const items = parseLeitura(await fetchText(leituraUrl(day, section)));
        for (const item of items) {
          const header = isCatalogued(item);
          if (header) found.push({ item, header, day: pubIso(item.pubDate, day), section });
        }
      } catch (err) {
        // Extra editions and supplements do not exist on most days; only the regular section is an error.
        if (section === "do1" || !(err instanceof HttpError && err.status === 404)) errors.push(`${day} ${section}: ${describeError(err)}`);
      }
    }
  }
  log(`DOU: ${found.length} catalogued acts in ${days.length} day(s)`);

  const records = await mapLimit(found, concurrency, async ({ item, header, day, section }) => {
    let ementa: string | null = null;
    try {
      ementa = parseEmenta(await fetchText(actUrl(item.urlTitle)));
    } catch (err) {
      errors.push(`${item.urlTitle}: ${describeError(err)}`);
    }
    ementa ??= item.content ? clean(item.content) : "";
    return toRecord(item, header, ementa, day, section);
  });
  return { records, errors };
}
