/**
 * Câmara Municipal de São Paulo, through its public web service (splegisws.saopaulo.sp.leg.br/ws/ws2.asmx).
 *
 *   PromoventesCMSPJSON                   everyone who can author a bill: vereadores, mayors (EXECUTIVO), committees...
 *   LeisAprovadasPorPromoventeJSON?Codigo laws that came from that author's bills: law number, publication date, bill, ementa
 *   VereadoresCMSPJSON                    vereadores with their party affiliation history (start and end dates)
 *
 * There is no "all laws" call, so the crawler asks for each author's laws and joins co-authored laws by number and
 * year. The vereador's party is the affiliation on the bill's year (the service gives the bill's year, not its
 * presentation day, so the date used is the law's publication date when the bill is from the same year, else
 * 1 July of the bill's year). Mayors are authors of kind `executive` with no party.
 */
import type { Author } from "../../lib/types.ts";
import { fetchJson, mapLimit } from "../estadual/http.ts";
import type { City } from "./cities.ts";
import { type AdapterResult, fold, normalizeParty, toPolicy } from "./common.ts";

export interface Promovente {
  chave: number;
  nome: string;
  sigla?: string;
  tipo: { chave: number; nome: string } | null;
}

export interface LeiAprovada {
  projeto: { tipo: string; numero: number; ano: number; ementa: string; promovente?: { chave: number; nome: string } | null };
  numero: number;
  publicacao: string | null;
}

export interface Vereador {
  chave: number;
  nome: string;
  filiacoes: { inicio: string; fim?: string | null; partido: { sigla: string } }[];
}

/** Bill types whose laws we keep: PL (projeto de lei) becomes a "Lei". PLO amends the Lei Orgânica: out of scope. */
const LAW_BILLS = new Set(["PL"]);

const BILL_PAGE = "https://splegisconsulta.saopaulo.sp.leg.br/Pesquisa/DetailsDetalhado";

/** Promovente type -> our author kind. */
export function cmspKind(tipo: string | undefined): Author["kind"] {
  const t = fold(tipo ?? "");
  if (t === "vereador") return "councilor";
  if (t === "executivo") return "executive";
  if (/comiss/.test(t)) return "committee";
  if (/mesa/.test(t)) return "board";
  if (/partido|lider/.test(t)) return "group";
  if (/tribunal/.test(t)) return "other-power";
  return "other";
}

/** Affiliation of a vereador on `date` (YYYY-MM-DD), as the party was named then. */
export function cmspPartyOn(v: Vereador | undefined, date: string): string | null {
  const hit = v?.filiacoes.find((f) => f.inicio.slice(0, 10) <= date && (!f.fim || f.fim.slice(0, 10) >= date));
  return hit ? normalizeParty(hit.partido.sigla, date) : null;
}

interface Joined {
  law: LeiAprovada;
  authors: { p: Promovente }[];
}

/** Joins each author's laws into one entry per law (co-authored laws appear under every author). */
export function joinLaws(perAuthor: { p: Promovente; laws: LeiAprovada[] }[]): Joined[] {
  const byKey = new Map<string, Joined>();
  for (const { p, laws } of perAuthor) {
    for (const law of laws) {
      if (!LAW_BILLS.has(law.projeto.tipo) || !law.publicacao) continue;
      const key = `${law.numero}-${law.publicacao.slice(0, 4)}`;
      const j = byKey.get(key) ?? { law, authors: [] };
      if (!j.authors.some((a) => a.p.chave === p.chave)) j.authors.push({ p });
      byKey.set(key, j);
    }
  }
  return [...byKey.values()];
}

export function cmspToPolicy(city: City, j: Joined, vereadores: Map<number, Vereador>) {
  const { law } = j;
  const date = law.publicacao!.slice(0, 10);
  const billYear = law.projeto.ano;
  const partyDate = Number(date.slice(0, 4)) === billYear ? date : `${billYear}-07-01`;
  const authors: Author[] = j.authors.map(({ p }) => {
    const kind = cmspKind(p.tipo?.nome);
    return { name: p.nome, kind, party: kind === "councilor" ? cmspPartyOn(vereadores.get(p.chave), partyDate) : null, uf: city.uf };
  });
  const bill = `PL ${law.projeto.numero}/${billYear}`;
  const q = new URLSearchParams({ COD_MTRA_LEGL: "1", ANO_PCSS_CMSP: String(billYear), COD_PCSS_CMSP: String(law.projeto.numero) });
  return toPolicy({
    city,
    type: "lei",
    number: String(law.numero),
    year: Number(date.slice(0, 4)),
    date,
    ementa: law.projeto.ementa,
    bill,
    authors,
    sources: [{ label: `${city.house}: ${bill}, que deu origem à lei`, url: `${BILL_PAGE}?${q}` }],
  });
}

/**
 * `years` keeps laws published in those years. Every author is asked each run (about 600 small requests), because
 * the service has no "laws since" call. `limit` caps authors asked (smoke tests).
 */
export async function crawlCmsp(city: City, years: number[], { limit = Infinity, concurrency = 2 }: { limit?: number; concurrency?: number } = {}): Promise<AdapterResult> {
  const base = city.url.replace(/\/$/, "");
  const errors: string[] = [];
  const [promoventes, vereadores] = await Promise.all([
    fetchJson<Promovente[]>(`${base}/PromoventesCMSPJSON`),
    fetchJson<Vereador[]>(`${base}/VereadoresCMSPJSON`),
  ]);
  const wanted = promoventes.filter((p) => !/^teste$/i.test(p.nome)).slice(0, limit);
  const perAuthor = await mapLimit(wanted, concurrency, async (p) => {
    try {
      return { p, laws: await fetchJson<LeiAprovada[]>(`${base}/LeisAprovadasPorPromoventeJSON?Codigo=${p.chave}`) };
    } catch (err) {
      errors.push(`${city.name} promovente ${p.chave}: ${err}`);
      return { p, laws: [] };
    }
  });
  const yearSet = new Set(years);
  const byId = new Map(vereadores.map((v) => [v.chave, v]));
  const joined = joinLaws(perAuthor).filter((j) => yearSet.has(Number(j.law.publicacao!.slice(0, 4))));
  const records = joined.map((j) => cmspToPolicy(city, j, byId));
  const info = [`authors asked: ${wanted.length} of ${promoventes.length}, vereadores with affiliations: ${vereadores.filter((v) => v.filiacoes.length).length}`];
  return { records, errors, info };
}
