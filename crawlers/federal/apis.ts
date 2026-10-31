// Thin clients for the Senado Federal and Câmara dos Deputados open-data APIs.
// Docs: https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html
//       https://dadosabertos.camara.leg.br/swagger/api.html
import { arr, type FetchJson } from "../lib/http.ts";
import { legislatureAt, partyNameAt } from "./politics.ts";

export const SENADO = "https://legis.senado.leg.br/dadosabertos";
export const CAMARA = "https://dadosabertos.camara.leg.br/api/v2";

export type NormType = "LEI" | "LCP" | "MPV";

/** One entry of /legislacao/lista. */
export interface SenadoNorm {
  id: string;
  tipo: string;
  numero: string;
  reedicao?: string;
  norma: string;
  normaNome: string;
  ementa: string;
  dataassinatura: string;
  apelido?: string;
}

/** One entry of /processo (list). */
export interface SenadoProcessSummary {
  id: number;
  codigoMateria?: number;
  identificacao: string;
  autoria?: string;
  dataApresentacao?: string;
  normaGerada?: string;
  situacaoAtual?: string;
  tramitando?: string;
  tipoDocumento?: string;
  siglaTipoDeliberacao?: string;
  objetivo?: string;
}

export interface SenadoAuthor {
  autor: string;
  siglaTipo?: string;
  descricaoTipo?: string;
  codigoParlamentar?: number;
  siglaPartido?: string;
  ente?: string;
  siglaEnte?: string;
}

/** The parts of /processo/{id} we use. */
export interface SenadoProcess {
  id: number;
  codigoMateria?: number;
  identificacao: string;
  siglaCasaIniciadora?: string;
  identificacaoProcessoInicial?: string;
  idProcessoCasaInicial?: number;
  autoriaIniciativa?: SenadoAuthor[];
  documento?: { dataApresentacao?: string; autoria?: SenadoAuthor[] };
  normaGerada?: { observacao?: string; dataPublicacao?: string; veiculoPublicacao?: string };
}

export interface Deputy {
  id: number;
  name: string;
  party: string | null;
  uf: string | null;
}

export function makeApis(fetchJson: FetchJson) {
  const memo = new Map<string, Promise<unknown>>();
  const cached = <T>(url: string): Promise<T> => {
    if (!memo.has(url)) memo.set(url, fetchJson(url));
    return memo.get(url) as Promise<T>;
  };

  return {
    async listNorms(type: NormType, year: number): Promise<SenadoNorm[]> {
      const j = await fetchJson(`${SENADO}/legislacao/lista.json?ano=${year}&tipo=${type}`);
      return arr((j as any)?.ListaDocumento?.documentos?.documento) as SenadoNorm[];
    },

    /** Processes that generated norms of `type` signed in `year` (bills, MP conversions, vetoes). */
    async processesByNorm(type: "LEI" | "LCP", year: number): Promise<SenadoProcessSummary[]> {
      return arr((await fetchJson(`${SENADO}/processo?tipoNorma=${type}&anoNorma=${year}`)) as SenadoProcessSummary[]);
    },

    async mpProcesses(year: number): Promise<SenadoProcessSummary[]> {
      return arr((await fetchJson(`${SENADO}/processo?sigla=MPV&ano=${year}`)) as SenadoProcessSummary[]);
    },

    process: (id: number) => cached<SenadoProcess | null>(`${SENADO}/processo/${id}`),

    /** A senator's party on `date`, from their affiliation history. Falls back to `hint` (the API's current label). */
    async senatorAt(code: number, date: string, hint?: string | null): Promise<{ party: string | null; uf: string | null }> {
      const [fil, det] = await Promise.all([
        cached<any>(`${SENADO}/senador/${code}/filiacoes.json`).catch(() => null),
        cached<any>(`${SENADO}/senador/${code}.json`).catch(() => null),
      ]);
      const uf = det?.DetalheParlamentar?.Parlamentar?.IdentificacaoParlamentar?.UfParlamentar ?? null;
      const rows = arr<any>(fil?.FiliacaoParlamentar?.Parlamentar?.Filiacoes?.Filiacao)
        .map((f) => ({ party: f?.Partido?.SiglaPartido as string, from: f?.DataFiliacao as string, to: (f?.DataDesfiliacao as string) ?? "9999" }))
        .filter((f) => f.party && f.from)
        .sort((a, b) => a.from.localeCompare(b.from));
      // The Senado's history often starts at the senator's first term, so an earlier date takes the first row.
      const hit = rows.find((f) => date >= f.from && date <= f.to) ?? (rows[0] && date < rows[0].from ? rows[0] : undefined);
      return { party: partyNameAt(hit?.party ?? hint ?? null, date), uf };
    },

    /** Câmara proposição id for e.g. ("PL", 3561, 1997). */
    async camaraBillId(sigla: string, numero: number, ano: number): Promise<number | null> {
      const j = await cached<any>(`${CAMARA}/proposicoes?siglaTipo=${encodeURIComponent(sigla)}&numero=${numero}&ano=${ano}&itens=5`);
      return arr<any>(j?.dados)[0]?.id ?? null;
    },

    async camaraBill(id: number): Promise<{ dataApresentacao?: string } | null> {
      return ((await cached<any>(`${CAMARA}/proposicoes/${id}`))?.dados ?? null) as { dataApresentacao?: string } | null;
    },

    /** Proposing deputies of a Câmara bill, each with party and state in the legislature of `date`. */
    async camaraAuthors(billId: number, date: string): Promise<{ name: string; type: string; deputy?: Deputy }[]> {
      const j = await cached<any>(`${CAMARA}/proposicoes/${billId}/autores`);
      const rows = arr<any>(j?.dados).filter((a) => a.proponente === 1 || a.proponente === undefined);
      return Promise.all(
        rows.map(async (a) => {
          const depId = Number(String(a.uri ?? "").match(/\/deputados\/(\d+)$/)?.[1]);
          if (!depId) return { name: a.nome, type: a.tipo ?? "" };
          const h = await cached<any>(`${CAMARA}/deputados/${depId}/historico`).catch(() => null);
          return { name: a.nome, type: a.tipo ?? "Deputado(a)", deputy: { id: depId, name: a.nome, ...deputyAt(arr<any>(h?.dados), date) } };
        }),
      );
    },
  };
}

export type Apis = ReturnType<typeof makeApis>;

/**
 * Party and state of a deputy on `date` from /deputados/{id}/historico. Rows carry the legislature;
 * for old legislatures `dataHora` is not meaningful, so we use the legislature first, then the
 * latest row inside it dated on or before `date`.
 */
export function deputyAt(rows: { dataHora?: string; siglaPartido?: string; siglaUf?: string; idLegislatura?: number }[], date: string) {
  const leg = legislatureAt(date);
  const legStart = `${1987 + (leg - 48) * 4}-02-01`;
  const inLeg = rows.filter((r) => r.idLegislatura === leg);
  const dated = inLeg
    .filter((r) => r.dataHora && r.dataHora.slice(0, 10) >= legStart && r.dataHora.slice(0, 10) <= date)
    .sort((a, b) => a.dataHora!.localeCompare(b.dataHora!));
  // No row in that legislature: leave party unknown rather than guess from another term.
  const hit = dated.at(-1) ?? inLeg[0];
  return { party: partyNameAt(hit?.siglaPartido ?? null, date), uf: hit?.siglaUf ?? null };
}
