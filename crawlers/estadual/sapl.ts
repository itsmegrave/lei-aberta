/**
 * Adapter for houses running Interlegis SAPL 3.x. The REST API is the same in every house:
 *
 *   /api/norma/tiponormajuridica/          law types (ids differ per house; matched by name / LexML equivalent)
 *   /api/norma/normajuridica/?tipo=&ano=   laws, paginated ({ pagination, results })
 *   /api/materia/materialegislativa/<id>/  the bill behind a law: presentation date and author ids
 *   /api/materia/autoria/?materia=<id>     authorship rows (fallback when the bill carries no author ids)
 *   /api/base/autor/, /api/base/tipoautor/ authors and their kind (deputy, executive, committee...)
 *   /api/parlamentares/filiacao/           party affiliation history (start/end dates) per deputy
 *   /api/parlamentares/partido/            party acronyms
 *
 * The author's party is the affiliation active on the bill's presentation date (else the law's date).
 * When no affiliation covers that date the party stays null; we never fall back to the current party.
 */
import type { Author } from "../../lib/types.ts";
import { type AdapterResult, type LawType, fold, bareNumber, https, lawType, toPolicy } from "./common.ts";
import { fetchJson, mapLimit } from "./http.ts";
import type { StateHouse } from "./states.ts";

interface Page<T> {
  pagination?: { next_page?: number | null; total_pages?: number };
  results: T[];
}

export interface TipoNorma {
  id: number;
  sigla?: string;
  descricao: string;
  equivalente_lexml?: string | null;
}

export interface Norma {
  id: number;
  numero: string;
  ano: number;
  data: string | null;
  data_publicacao?: string | null;
  ementa: string;
  tipo: number;
  materia: number | null;
  complemento?: boolean | string | null;
  texto_integral?: string | null;
  autores?: number[];
}

export interface Materia {
  id: number;
  data_apresentacao?: string | null;
  autores?: number[];
}

export interface Autoria {
  autor: number;
  materia: number;
  primeiro_autor?: boolean;
}

export interface Autor {
  id: number;
  nome: string;
  tipo: number;
  object_id?: number | null;
  cargo?: string | null;
}

export interface TipoAutor {
  id: number;
  descricao: string;
}

export interface Filiacao {
  parlamentar: number;
  partido: number;
  data: string;
  data_desfiliacao: string | null;
  __str__?: string;
}

export interface Partido {
  id: number;
  sigla: string;
}

/** Everything about authors a house needs, loaded once per run. */
export interface AuthorBook {
  autores: Map<number, Autor>;
  tipos: Map<number, string>;
  filiacoes: Map<number, Filiacao[]>;
  partidos: Map<number, string>;
}

const PAGE_SIZE = 100;

/** Reads every page of a SAPL list endpoint. Accepts both paginated and bare-array responses. */
export async function listAll<T>(base: string, path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), page: String(page), page_size: String(PAGE_SIZE) });
    const body = await fetchJson<Page<T> | T[]>(`${base}${path}?${q}`);
    if (Array.isArray(body)) return out.concat(body);
    out.push(...body.results);
    if (!body.pagination?.next_page || body.results.length === 0) return out;
  }
}

/** Picks the house's type ids for the laws we collect. */
export function targetTypes(tipos: TipoNorma[]): Map<number, LawType> {
  const out = new Map<number, LawType>();
  for (const t of tipos) {
    const lt = lawType(t.descricao, t.equivalente_lexml);
    if (lt) out.set(t.id, lt);
  }
  return out;
}

/** deputy | executive | committee | board | other, from the SAPL author type name and the author's cargo. */
export function authorKind(tipoDescricao: string | undefined, cargo?: string | null, nome?: string): Author["kind"] {
  const t = fold(`${tipoDescricao ?? ""} ${cargo ?? ""}`);
  if (/parlamentar|deputad/.test(t)) return "state-deputy";
  if (/executivo|governad|governo/.test(t) || /^(governo|governador|poder executivo)/.test(fold(nome ?? ""))) return "executive";
  if (/comiss/.test(t)) return "committee";
  if (/mesa/.test(t)) return "board";
  if (/judici|tribunal|ministerio publico|defensoria|tribunal de contas/.test(t)) return "other-power";
  return "other";
}

/** "Adriano Galdino - PSB - Partido Socialista Brasileiro" -> "PSB". */
export function siglaFromStr(s: string | undefined): string | null {
  const parts = (s ?? "").split(" - ");
  return parts.length >= 3 ? parts[parts.length - 2].trim() || null : null;
}

/** The party the deputy was affiliated to on `date` (YYYY-MM-DD), or null if no affiliation covers it. */
export function partyOn(book: Pick<AuthorBook, "filiacoes" | "partidos">, parlamentar: number, date: string | null): string | null {
  if (!date) return null;
  const rows = book.filiacoes.get(parlamentar) ?? [];
  const hit = rows.find((f) => f.data <= date && (!f.data_desfiliacao || f.data_desfiliacao >= date));
  if (!hit) return null;
  return book.partidos.get(hit.partido) ?? siglaFromStr(hit.__str__);
}

export function toAuthor(book: AuthorBook, autorId: number, uf: string, date: string | null): Author | null {
  const a = book.autores.get(autorId);
  if (!a) return null;
  const kind = authorKind(book.tipos.get(a.tipo), a.cargo, a.nome);
  const party = kind === "state-deputy" && a.object_id != null ? partyOn(book, a.object_id, date) : null;
  return { name: a.nome.trim(), kind, party, uf };
}

async function loadAuthorBook(base: string): Promise<AuthorBook> {
  // Each list is optional: a house that hides one still yields laws, just with fewer author details.
  const safe = async <T>(p: string) => listAll<T>(base, p).catch(() => [] as T[]);
  const [autores, tipos, filiacoes, partidos] = await Promise.all([
    safe<Autor>("/api/base/autor/"),
    safe<TipoAutor>("/api/base/tipoautor/"),
    safe<Filiacao>("/api/parlamentares/filiacao/"),
    safe<Partido>("/api/parlamentares/partido/"),
  ]);
  const fil = new Map<number, Filiacao[]>();
  for (const f of filiacoes) {
    if (!fil.has(f.parlamentar)) fil.set(f.parlamentar, []);
    fil.get(f.parlamentar)!.push(f);
  }
  return {
    autores: new Map(autores.map((a) => [a.id, a])),
    tipos: new Map(tipos.map((t) => [t.id, t.descricao])),
    filiacoes: fil,
    partidos: new Map(partidos.map((p) => [p.id, p.sigla])),
  };
}

/** Turns one SAPL law plus its bill into a record. Pure; tested with fixtures. */
export function saplToPolicy(house: StateHouse, type: LawType, n: Norma, materia: Materia | null, autorIds: number[], book: AuthorBook) {
  const date = n.data ?? n.data_publicacao ?? null;
  const year = date ? Number(date.slice(0, 4)) : n.ano;
  const presentedAt = materia?.data_apresentacao ?? null;
  const partyDate = presentedAt ?? date;
  const authors = autorIds.map((id) => toAuthor(book, id, house.uf, partyDate)).filter((a): a is Author => a !== null);
  const complement = typeof n.complemento === "string" ? n.complemento : null;
  const sources = [{ label: `${house.house} (SAPL)`, url: `${house.url}/norma/${n.id}` }];
  if (n.texto_integral) sources.push({ label: "Texto integral", url: https(n.texto_integral) });
  return toPolicy({ house, type, number: bareNumber(n.numero, complement), year, date, ementa: n.ementa, presentedAt, authors, sources });
}

export async function crawlSapl(house: StateHouse, years: number[], { concurrency = 3 } = {}): Promise<AdapterResult> {
  const base = house.url.replace(/\/$/, "");
  const errors: string[] = [];
  const records: AdapterResult["records"] = [];

  const types = targetTypes(await listAll<TipoNorma>(base, "/api/norma/tiponormajuridica/"));
  if (!types.size) return { records, errors: [`${house.uf}: no law types matched in tiponormajuridica`] };
  const book = await loadAuthorBook(base);

  for (const [tipoId, type] of types) {
    for (const ano of years) {
      let normas: Norma[];
      try {
        normas = await listAll<Norma>(base, "/api/norma/normajuridica/", { tipo: tipoId, ano });
      } catch (err) {
        errors.push(`${house.uf} ${type} ${ano}: ${err}`);
        continue;
      }
      const rows = await mapLimit(normas, concurrency, async (n) => {
        try {
          let materia: Materia | null = null;
          let autorIds = n.autores ?? [];
          if (n.materia) {
            materia = await fetchJson<Materia>(`${base}/api/materia/materialegislativa/${n.materia}/`).catch(() => null);
            if (!autorIds.length) autorIds = materia?.autores ?? [];
            if (!autorIds.length) {
              const autorias = await listAll<Autoria>(base, "/api/materia/autoria/", { materia: n.materia }).catch(() => []);
              autorIds = autorias.sort((a, b) => Number(!!b.primeiro_autor) - Number(!!a.primeiro_autor)).map((a) => a.autor);
            }
          }
          return saplToPolicy(house, type, n, materia, autorIds, book);
        } catch (err) {
          errors.push(`${house.uf} norma ${n.id}: ${err}`);
          return null;
        }
      });
      for (const r of rows) if (r) records.push(r);
    }
  }
  return { records, errors };
}
