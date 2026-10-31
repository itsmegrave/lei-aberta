/**
 * Adapter for São Paulo (Alesp). Alesp publishes full XML dumps, refreshed daily, at
 * https://www.al.sp.gov.br/dados-abertos/ (layouts in repositorioDados/docs/...):
 *
 *   legislacao/legislacao_tipo_normas.xml   <IdTipo>, <DsTipo>
 *   legislacao/legislacao_normas.zip        <norma>: idNorma, idTipo, numero, complemento, data, ementa,
 *                                           situacao (1 em vigor, 2 inconstitucional, 3 suspensa, 4 exaurida,
 *                                           5 revogada, 6 anulada), promulg (E/L), idPropositura, urlFicha
 *
 * Each norm row carries its authors as text (<Autores>). Alesp has no party-affiliation history, so a deputy's
 * party comes from TSE: the party they were elected under in the last state election before the law
 * (`partyBasis: "election"`). Unmatched names keep party null; we never use today's party.
 */
import type { Author } from "../../lib/types.ts";
import { type AdapterResult, type LawType, bareNumber, fold, https, lawType, toPolicy } from "./common.ts";
import { fetchBuffer } from "./http.ts";
import type { StateHouse } from "./states.ts";
import { loadPartyAtElection } from "./tse.ts";
import { child, decodeXml, decodeXmlStream, forEachElement, zipTextChunks } from "./zip.ts";

const BASE = "https://www.al.sp.gov.br/repositorioDados";

export function parseTipos(xml: string): Map<number, LawType> {
  const out = new Map<number, LawType>();
  const re = /<IdTipo>\s*(\d+)\s*<\/IdTipo>[\s\S]*?<DsTipo>([\s\S]*?)<\/DsTipo>/gi;
  for (const m of xml.matchAll(re)) {
    const lt = lawType(decodeXml(m[2]));
    if (lt) out.set(Number(m[1]), lt);
  }
  return out;
}

/** Finds the element that wraps each row: the innermost open tag before the first `field` in `head`. */
export function detectRecordTag(head: string, field: string): string | null {
  const at = head.search(new RegExp(`<${field}[\\s>]`, "i"));
  if (at < 0) return null;
  const stack: string[] = [];
  for (const m of head.slice(0, at).matchAll(/<(\/?)([A-Za-z_][\w.-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue; // self-closing
    if (m[1]) stack.pop();
    else stack.push(m[2]);
  }
  return stack.at(-1) ?? null;
}

/** Streams rows of an XML dump, detecting the row element from the first chunk. */
async function forEachRow(chunks: AsyncIterable<string>, field: string, fn: (xml: string) => void): Promise<number> {
  const it = chunks[Symbol.asyncIterator]();
  let head = "";
  const buffered: string[] = [];
  while (head.length < 8192) {
    const r = await it.next();
    if (r.done) break;
    head += r.value;
    buffered.push(r.value);
  }
  const tag = detectRecordTag(head, field);
  if (!tag) throw new Error(`no <${field}> found in the first ${head.length} chars`);
  async function* all() {
    yield* buffered;
    for (let r = await it.next(); !r.done; r = await it.next()) yield r.value;
  }
  return forEachElement(all(), tag, fn);
}

export function situacaoStatus(situacao: string, promulg: string): string {
  switch (situacao.trim()) {
    case "2":
      return "declarada inconstitucional";
    case "3":
      return "suspensa";
    case "4":
      return "eficácia exaurida";
    case "5":
      return "revogada";
    case "6":
      return "anulada";
    default:
      // Promulgated by the Assembly itself (veto overridden or not sanctioned in time).
      return promulg.trim().toUpperCase() === "L" ? "promulgada" : "sancionada";
  }
}

export function alespAuthorKind(name: string): Author["kind"] {
  const n = fold(name);
  if (/^(governador|governadora|poder executivo|governo do estado)/.test(n)) return "executive";
  if (/^mesa\b/.test(n)) return "board";
  if (/^comiss/.test(n)) return "committee";
  if (/^(tribunal|ministerio publico|defensoria|procuradoria)/.test(n)) return "other-power";
  return "state-deputy";
}

export interface AlespNorma {
  idNorma: string;
  type: LawType;
  number: string;
  year: number;
  date: string | null;
  ementa: string;
  status: string;
  /** <Autores>: "Delegado Olim, Altair Moraes, Marcio Nakashima e outros" (the list can be cut with "e outros"). */
  authors: string[];
  propositura: string;
  urlFicha: string;
}

/** "A, B, C e outros" -> ["A", "B", "C"]; "A e B" -> ["A", "B"]. */
export function splitAuthors(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+e\s+(?=[A-ZÀ-Ýa-z])/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s && !/^(e\s+)?outr[oa]s$/i.test(s));
}

/** Parses one <norma> row; returns null for types or years we do not collect. */
export function parseNorma(xml: string, tipos: Map<number, LawType>, years: { since: number; until: number }): AlespNorma | null {
  const type = tipos.get(Number(child(xml, "idTipo")));
  if (!type) return null;
  const date = child(xml, "data").slice(0, 10) || null;
  const year = date ? Number(date.slice(0, 4)) : NaN;
  if (!year || year < years.since || year > years.until) return null;
  return {
    idNorma: child(xml, "idNorma"),
    type,
    number: bareNumber(child(xml, "numero"), child(xml, "complemento")),
    year,
    date,
    ementa: child(xml, "ementa"),
    status: situacaoStatus(child(xml, "situacao"), child(xml, "promulg")),
    authors: splitAuthors(child(xml, "Autores")),
    propositura: child(xml, "propositura"),
    urlFicha: child(xml, "urlFicha"),
  };
}

/**
 * `partyAt` looks up a deputy's party at the last election before the law (TSE data); null when unknown.
 * Alesp publishes no affiliation history, so this is the closest available stand-in for the party at authorship.
 */
export function alespToPolicy(house: StateHouse, n: AlespNorma, partyAt?: (name: string, date: string | null) => string | null) {
  const ficha = n.urlFicha && /^https?:\/\/([a-z0-9-]+\.)*al\.sp\.gov\.br\//i.test(n.urlFicha) ? https(n.urlFicha) : `https://www.al.sp.gov.br/norma/${n.idNorma}`;
  const authors: Author[] = [...new Set(n.authors)].map((name) => {
    const kind = alespAuthorKind(name);
    const party = kind === "state-deputy" && partyAt ? partyAt(name, n.date) : null;
    return party ? { name, kind, party, uf: house.uf, partyBasis: "election" } : { name, kind, party: null, uf: house.uf };
  });
  return toPolicy({
    house, type: n.type, number: n.number, year: n.year, date: n.date, ementa: n.ementa, status: n.status, bill: n.propositura || null, authors,
    sources: [{ label: "Alesp: ficha da norma", url: ficha }],
  });
}

export async function crawlAlesp(house: StateHouse, years: { since: number; until: number }): Promise<AdapterResult> {
  const errors: string[] = [];
  const tiposBuf = await fetchBuffer(`${BASE}/legislacao/legislacao_tipo_normas.xml`, { accept: "application/xml" });
  let tiposXml = "";
  for await (const c of decodeXmlStream([tiposBuf])) tiposXml += c;
  const tipos = parseTipos(tiposXml);
  if (!tipos.size) return { records: [], errors: ["SP: no law types matched in legislacao_tipo_normas.xml"] };

  const info = [`types: ${[...tipos].map(([k, v]) => `${k}=${v}`).join(", ")}`];
  // The dump can list a norm more than once; keep one row per idNorma.
  const byId = new Map<string, AlespNorma>();
  let rows = 0;
  let keptRow = "";
  const zip = await fetchBuffer(`${BASE}/legislacao/legislacao_normas.zip`);
  await forEachRow(zipTextChunks(zip, ".xml"), "idNorma", (xml) => {
    rows++;
    const n = parseNorma(xml, tipos, years);
    if (n && !keptRow) keptRow = xml;
    if (n && !byId.has(n.idNorma)) byId.set(n.idNorma, n);
  });
  const normas = [...byId.values()];
  info.push(`norm rows: ${rows}, kept: ${normas.length}; first kept row: ${keptRow.replace(/\s+/g, " ").slice(0, 600)}`);

  // Party at election time from TSE, matched by name. Optional: without it, parties stay null.
  const tse = await loadPartyAtElection(house.uf).catch((err) => ({ table: null, info: [`TSE: ${err}`] }));
  info.push(...tse.info);
  let matched = 0;
  let deputies = 0;
  const partyAt = (name: string, date: string | null) => {
    deputies++;
    const hit = tse.table?.partyFor(name, date) ?? null;
    if (hit) matched++;
    return hit?.party ?? null;
  };
  const records = normas.map((n) => alespToPolicy(house, n, partyAt));
  info.push(`deputy authors: ${deputies}, party found at election: ${matched}`);
  return { records, errors, info };
}
