/**
 * Câmaras Municipais running Interlegis SAPL 3.x. The API is the one the state assemblies use, so this reuses the
 * state adapter's readers (crawlers/estadual/sapl.ts) and only changes what is municipal: law types, author kinds
 * (vereador, prefeito) and the record id.
 *
 * The author's party is the vereador's affiliation on the bill's presentation date (else the law's date), from the
 * câmara's own filiação history. No affiliation covering that date means party null; we never use the current party.
 */
import type { Author } from "../../lib/types.ts";
import { fetchJson, mapLimit } from "../estadual/http.ts";
import {
  type AuthorBook,
  type Autoria,
  type Materia,
  type Norma,
  type TipoNorma,
  authorKind,
  listAll,
  loadAuthorBook,
  partyOn,
} from "../estadual/sapl.ts";
import { https } from "../estadual/common.ts";
import type { City } from "./cities.ts";
import { type AdapterResult, type MunicipalLawType, bareNumber, fold, municipalId, municipalLawType, normalizeParty, toPolicy } from "./common.ts";

export function targetTypes(tipos: TipoNorma[]): Map<number, MunicipalLawType> {
  const out = new Map<number, MunicipalLawType>();
  for (const t of tipos) {
    const lt = municipalLawType(t.descricao);
    if (lt) out.set(t.id, lt);
  }
  return out;
}

/**
 * councilor | executive | group | committee | board | other-power | other.
 * Câmaras file the mayor as "Executivo", "Chefe do Poder Executivo", or "Externo" with cargo "Prefeito em Exercício".
 */
export function municipalAuthorKind(tipo: string | undefined, cargo?: string | null, nome?: string): Author["kind"] {
  const t = fold(tipo ?? "");
  const c = fold(cargo ?? "");
  const n = fold(nome ?? "");
  if (/executivo|prefeit/.test(t) || /prefeit/.test(c) || /^(poder executivo|chefe do executivo|prefeitura|prefeito|prefeita)\b/.test(n)) return "executive";
  const k = authorKind(tipo, cargo, nome);
  if (k === "state-deputy" || (!t && /vereador/.test(c))) return "councilor";
  if (/^vereadores$/.test(t)) return "group";
  return k;
}

export function toAuthor(book: AuthorBook, autorId: number, uf: string, date: string | null): Author | null {
  const a = book.autores.get(autorId);
  if (!a) return null;
  const kind = municipalAuthorKind(book.tipos.get(a.tipo), a.cargo, a.nome);
  const party = kind === "councilor" && a.object_id != null ? normalizeParty(partyOn(book, a.object_id, date), date) : null;
  return { name: a.nome.trim(), kind, party, uf };
}

const lawDate = (n: Norma) => n.data ?? n.data_publicacao ?? null;
const lawNumber = (n: Norma) => bareNumber(n.numero, typeof n.complemento === "string" ? n.complemento : null);

/** The record id a SAPL law will get, known before any per-law request. */
export function saplId(city: City, type: MunicipalLawType, n: Norma): string {
  const date = lawDate(n);
  return municipalId(city.ibge, type, lawNumber(n), date ? Number(date.slice(0, 4)) : n.ano);
}

/** One SAPL law plus its bill as a record. Pure; tested with fixtures. */
export function saplToPolicy(city: City, type: MunicipalLawType, n: Norma, materia: Materia | null, autorIds: number[], book: AuthorBook) {
  const date = lawDate(n);
  const year = date ? Number(date.slice(0, 4)) : n.ano;
  const presentedAt = materia?.data_apresentacao ?? null;
  const authors = autorIds.map((id) => toAuthor(book, id, city.uf, presentedAt ?? date)).filter((a): a is Author => a !== null);
  const sources = [{ label: `${city.house} (SAPL)`, url: `${city.url}/norma/${n.id}` }];
  if (n.texto_integral) sources.push({ label: "Texto integral", url: https(n.texto_integral) });
  return toPolicy({ city, type, number: lawNumber(n), year, date, ementa: n.ementa, presentedAt, bill: materia?.__str__ ?? null, authors, sources });
}

export async function crawlSaplCity(
  city: City,
  years: number[],
  { concurrency = 3, limit = Infinity, skip = () => false }: { concurrency?: number; limit?: number; skip?: (id: string) => boolean } = {},
): Promise<AdapterResult> {
  const base = city.url.replace(/\/$/, "");
  const errors: string[] = [];
  const records: AdapterResult["records"] = [];
  const types = targetTypes(await listAll<TipoNorma>(base, "/api/norma/tiponormajuridica/"));
  if (!types.size) return { records, errors: [`${city.name}: no law types matched in tiponormajuridica`] };
  const book = await loadAuthorBook(base);
  const info = [
    `types: ${[...types].map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `authors: ${book.autores.size}, author types: ${[...book.tipos.values()].join("/")}, affiliations: ${[...book.filiacoes.values()].flat().length}`,
  ];
  for (const [tipoId, type] of types) {
    for (const ano of years) {
      let normas: Norma[];
      try {
        normas = (await listAll<Norma>(base, "/api/norma/normajuridica/", { tipo: tipoId, ano }, limit)).filter((n) => !skip(saplId(city, type, n))).slice(0, limit);
      } catch (err) {
        errors.push(`${city.name} ${type} ${ano}: ${err}`);
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
          return saplToPolicy(city, type, n, materia, autorIds, book);
        } catch (err) {
          errors.push(`${city.name} norma ${n.id}: ${err}`);
          return null;
        }
      });
      for (const r of rows) if (r) records.push(r);
    }
  }
  return { records, errors, info };
}
