// Turns Senado/Câmara API data into Lei Aberta records (lib/types.ts `Policy`).
import type { Store } from "../lib/store.ts";
import type { Author, Policy } from "../../lib/types.ts";
import type { Apis, NormType, SenadoAuthor, SenadoNorm, SenadoProcessSummary } from "./apis.ts";
import { presidentAt } from "./politics.ts";
import { brDateToIso, cleanEmenta, formatNumber, guessAreas, nickname } from "./text.ts";

const TYPE = {
  LEI: { type: "lei", idPart: "lei", urn: "lei", label: "Lei" },
  LCP: { type: "lei-complementar", idPart: "lc", urn: "lei.complementar", label: "Lei Complementar" },
  MPV: { type: "medida-provisoria", idPart: "mp", urn: "medida.provisoria", label: "Medida Provisória" },
} as const;

/** EC 32 (2001-09-11) ended MP reissues and restarted MP numbering at 1. */
export const EC32 = "2001-09-11";

export const EXECUTIVE_AUTHOR: Author = { name: "Poder Executivo", kind: "executive", party: null, uf: null };

export const recordId = (type: NormType, numero: string, year: number) => `federal-${TYPE[type].idPart}-${numero.replace(/\D/g, "")}-${year}`;

export const normasUrl = (type: NormType, date: string, numero: string) =>
  `https://normas.leg.br/?urn=urn:lex:br:federal:${TYPE[type].urn}:${date};${numero}`;
export const senadoMateriaUrl = (codigo: number) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}`;
export const camaraBillUrl = (id: number) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

/** "Lei nº 10.741 de 01/10/2003" -> { numero: "10741", date: "2003-10-01" } */
export function parseNormaGerada(s: string | undefined): { kind: string; numero: string; date: string } | null {
  const m = s?.match(/^(Lei Complementar|Lei)\s+n[º°o]\s*([\d.]+)\s+de\s+(\d{2}\/\d{2}\/\d{4})/i);
  return m ? { kind: m[1], numero: m[2].replace(/\./g, ""), date: brDateToIso(m[3])! } : null;
}

/** "PL 3561/1997" -> { sigla: "PL", numero: 3561, ano: 1997 }; "MPV 1731-34/1999" keeps the reissue. */
export function parseIdent(s: string | undefined): { sigla: string; numero: number; reissue: number; ano: number } | null {
  const m = s?.match(/^([A-Z]+)\s+(\d+)(?:-(\d+))?\/(\d{4})$/);
  return m ? { sigla: m[1], numero: Number(m[2]), reissue: Number(m[3] ?? 0), ano: Number(m[4]) } : null;
}

const isPresidency = (a: SenadoAuthor) => /presid[eê]n(cia|te) da rep[uú]blica/i.test(`${a.autor} ${a.ente ?? ""}`) || a.siglaTipo === "PRESIDENTE_REPUBLICA";

function authorKind(a: SenadoAuthor): string {
  const t = `${a.siglaTipo ?? ""} ${a.descricaoTipo ?? ""}`.toUpperCase();
  if (t.includes("SENADOR")) return "senator";
  if (t.includes("DEPUTADO")) return "deputy";
  if (/COMISS/.test(t) || /^Comiss/i.test(a.autor)) return "committee";
  if (/TRIBUNAL|SUPREMO|JUDICI/i.test(`${t} ${a.autor}`)) return "judiciary";
  if (/PROCURADOR|MINIST[EÉ]RIO P[UÚ]BLICO|DEFENSORIA/i.test(`${t} ${a.autor}`)) return "prosecution";
  return "other";
}

const titleCaseName = (s: string) =>
  /\p{Ll}/u.test(s) ? s : s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, sp, c) => sp + c.toUpperCase()).replace(/\s(D[aeo]s?|E)\s/g, (m) => m.toLowerCase());

/** Picks the bill behind a norm: drops veto messages, then the earliest presented. */
export function pickProcess(list: SenadoProcessSummary[]): SenadoProcessSummary | undefined {
  const bills = list.filter((p) => !/^VET\b/.test(p.identificacao) && p.tipoDocumento !== "Mensagem");
  return (bills.length ? bills : list).slice().sort((a, b) => (a.dataApresentacao ?? "").localeCompare(b.dataApresentacao ?? ""))[0];
}

export interface Authorship {
  authors: Author[];
  presentedAt: string | null;
  bill: string | null;
  sources: Policy["sources"];
}

/** Resolves who proposed the bill and their party at the time it was presented. */
export async function resolveAuthorship(apis: Apis, proc: SenadoProcessSummary): Promise<Authorship> {
  const sources: Policy["sources"] = [];
  if (proc.codigoMateria) sources.push({ label: `${proc.identificacao} no Senado`, url: senadoMateriaUrl(proc.codigoMateria) });
  const detail = await apis.process(proc.id).catch(() => null);
  const initial = detail?.identificacaoProcessoInicial ?? proc.identificacao;
  const raw = detail?.autoriaIniciativa?.length ? detail.autoriaIniciativa : (detail?.documento?.autoria ?? []);
  let presentedAt = proc.dataApresentacao?.slice(0, 10) ?? null;

  // Executive bills and MPs: the author is the executive branch, which carries no party here;
  // the president's party lives in the separate `executive` field.
  if (/presid[eê]ncia da rep[uú]blica/i.test(proc.autoria ?? "") || raw.some(isPresidency) || /^(MPV|PLV)\b/.test(initial)) {
    return { authors: [EXECUTIVE_AUTHOR], presentedAt, bill: initial, sources };
  }

  // Bills that started in the Câmara: authorship and party come from the Câmara API.
  const fromCamara = detail?.siglaCasaIniciadora === "CD" || /^C[aâ]mara dos Deputados$/i.test(proc.autoria ?? "");
  if (fromCamara) {
    const id = parseIdent(initial);
    const billId = id ? await apis.camaraBillId(id.sigla, id.numero, id.ano).catch(() => null) : null;
    if (billId) {
      sources.push({ label: `${initial} na Câmara`, url: camaraBillUrl(billId) });
      const bill = await apis.camaraBill(billId).catch(() => null);
      presentedAt = bill?.dataApresentacao?.slice(0, 10) ?? presentedAt;
      const rows = await apis.camaraAuthors(billId, presentedAt ?? `${id!.ano}-06-30`).catch(() => []);
      const authors: Author[] = rows.map((r) =>
        r.deputy
          ? { name: r.deputy.name, kind: "deputy", party: r.deputy.party, uf: r.deputy.uf }
          : /presid[eê]ncia da rep[uú]blica|poder executivo/i.test(r.name)
            ? EXECUTIVE_AUTHOR
            : { name: r.name, kind: /comiss/i.test(r.name) ? "committee" : /senado/i.test(r.name) ? "senator" : "other", party: null, uf: null },
      );
      if (authors.some((a) => a.kind === "executive")) return { authors: [EXECUTIVE_AUTHOR], presentedAt, bill: initial, sources };
      if (authors.length) return { authors, presentedAt, bill: initial, sources };
    }
  }

  const date = presentedAt ?? "";
  const authors = await Promise.all(
    raw
      .filter((a) => a.autor && !/^(C[aâ]mara dos Deputados|Senado Federal)$/i.test(a.autor))
      .map(async (a): Promise<Author> => {
        const kind = authorKind(a);
        if (kind === "senator" && a.codigoParlamentar && date) {
          const s = await apis.senatorAt(a.codigoParlamentar, date, a.siglaPartido).catch(() => ({ party: null, uf: null }));
          // Old senators have no state in their profile; the process summary reads "Senador X (MDB/MG)".
          const uf = s.uf ?? (raw.length === 1 ? (proc.autoria?.match(/\/([A-Z]{2})\)\s*$/)?.[1] ?? null) : null);
          return { name: titleCaseName(a.autor), kind, party: s.party, uf };
        }
        // Deputies listed only by the Senado carry today's party label, not the one at authorship: leave it unknown.
        return { name: titleCaseName(a.autor), kind, party: null, uf: null };
      }),
  );
  return { authors, presentedAt, bill: initial, sources };
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

export function lawRecord(type: "LEI" | "LCP", n: SenadoNorm, auth: Authorship | null): Policy {
  const date = brDateToIso(n.dataassinatura)!;
  const year = Number(date.slice(0, 4));
  const label = `${TYPE[type].label} nº ${formatNumber(n.numero)}/${year}`;
  const nick = nickname(n.apelido, n.norma, year);
  const summary = cleanEmenta(n.ementa);
  const authors = auth?.authors ?? [];
  return {
    id: recordId(type, n.numero, year),
    level: "federal",
    jurisdiction: "Brasil",
    type: TYPE[type].type,
    number: formatNumber(n.numero),
    title: nick ?? label,
    summary,
    year,
    signedAt: date,
    presentedAt: auth?.presentedAt ?? null,
    status: "sancionada",
    areas: guessAreas(`${nick ?? ""} ${summary}`),
    authors,
    parties: uniq(authors.map((a) => a.party).filter((p): p is string => Boolean(p))),
    executive: presidentAt(date),
    bill: auth?.bill ?? null,
    sources: [{ label: `${label} (texto oficial)`, url: normasUrl(type, date, n.numero) }, ...(auth?.sources ?? [])],
  };
}

/** Status of an MP from the Senado process of its latest edition. */
export function mpStatus(p: SenadoProcessSummary | undefined): string {
  if (!p) return "sem-informacao";
  const s = (p.situacaoAtual ?? "").toUpperCase();
  if (p.tramitando === "Sim") return "em-tramitacao";
  if (p.normaGerada || /TRANSFORMADA EM NORMA|APROVADA|PROMULGA/.test(s)) return "convertida";
  if (/REJEITADA/.test(s)) return "rejeitada";
  if (/EFIC[AÁ]CIA|PRAZO|ENCERRAD/.test(s)) return "perdeu-eficacia";
  if (/REVOGADA/.test(s)) return "revogada";
  if (/REEDITADA/.test(s) || p.siglaTipoDeliberacao === "REEDITADA") return "reeditada";
  return s ? s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "sem-informacao";
}

/**
 * One record per MP. Before EC 32 an MP could be reissued every 30 days under the same number
 * ("MP 1.963-17"); the record keeps the first edition's date and links the latest edition.
 */
export function mpRecord(editions: SenadoNorm[], proc: SenadoProcessSummary | undefined): Policy {
  const sorted = editions.slice().sort((a, b) => Number(a.reedicao ?? 0) - Number(b.reedicao ?? 0));
  const first = sorted[0];
  const last = sorted.at(-1)!;
  const date = brDateToIso(first.dataassinatura)!;
  const lastDate = brDateToIso(last.dataassinatura)!;
  const year = Number(date.slice(0, 4));
  const label = `Medida Provisória nº ${formatNumber(first.numero)}/${year}`;
  const nick = nickname(first.apelido, first.norma, year);
  const summary = cleanEmenta(last.ementa || first.ementa);
  const converted = parseNormaGerada(proc?.normaGerada);
  const lastNum = last.reedicao && last.reedicao !== "0" ? `${first.numero}-${last.reedicao}` : first.numero;
  const sources: Policy["sources"] = [{ label: `${label} (texto oficial)`, url: normasUrl("MPV", date, first.numero) }];
  if (lastNum !== first.numero)
    sources.push({ label: `Última reedição, MP nº ${formatNumber(first.numero)}-${last.reedicao} (texto oficial)`, url: normasUrl("MPV", lastDate, lastNum) });
  if (proc?.codigoMateria) sources.push({ label: `${proc.identificacao} no Senado`, url: senadoMateriaUrl(proc.codigoMateria) });
  return {
    id: recordId("MPV", first.numero, year),
    level: "federal",
    jurisdiction: "Brasil",
    type: TYPE.MPV.type,
    number: formatNumber(first.numero),
    title: nick ?? label,
    summary,
    year,
    signedAt: date,
    presentedAt: date,
    status: mpStatus(proc),
    areas: guessAreas(`${nick ?? ""} ${summary}`),
    authors: [EXECUTIVE_AUTHOR],
    parties: [],
    executive: presidentAt(date),
    reissues: sorted.length > 1 ? sorted.length - 1 : undefined,
    convertedInto: converted ? recordId(converted.kind.toLowerCase().includes("complementar") ? "LCP" : "LEI", converted.numero, Number(converted.date.slice(0, 4))) : undefined,
    sources,
  };
}

// Incremental runs.

/** A law already stored with its authors needs no new lookups. */
export const isResolved = (store: Pick<Store, "get">, id: string) => (store.get(id)?.authors.length ?? 0) > 0;

/** Years of post-EC 32 MPs from the last year that were still open (or unknown) when last crawled. */
export function openMpYears(records: Policy[], thisYear: number): number[] {
  return [
    ...new Set(
      records
        .filter((r) => r.type === "medida-provisoria" && r.year >= thisYear - 1 && (r.signedAt ?? "") >= EC32)
        .filter((r) => r.status === "em-tramitacao" || r.status === "sem-informacao")
        .map((r) => r.year),
    ),
  ];
}
