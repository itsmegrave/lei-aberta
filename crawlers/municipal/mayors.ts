/**
 * Mayors of the capitals and the party they were elected under, from TSE's open candidate data
 * (consulta_cand_<year>.zip, one Latin-1 CSV per UF). This fills each municipal record's `executive` field, which is
 * kept apart from the authors' parties.
 *
 * A law is attributed to the mayor elected in the last ordinary election whose term had begun by the law's year
 * (terms run 1 January after the election to 31 December four years later). Two limits, both stated on the record
 * with `basis: "election"`:
 *   - the party is the one the mayor was elected under; a mid-term party switch is not tracked;
 *   - a vice-mayor who took over (death, resignation, removal) is not tracked: the elected mayor is shown.
 * TSE has candidate files from 1996 on, so laws before 1997 get no executive.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Executive } from "../../lib/types.ts";
import { HttpError, fetchBuffer } from "../estadual/http.ts";
import { csvLine } from "../estadual/tse.ts";
import { zipTextChunks } from "../estadual/zip.ts";
import type { City } from "./cities.ts";
import { fold, normalizeParty, titleCase } from "./common.ts";

export const MUNICIPAL_ELECTIONS = [1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024];

export interface Mayor {
  election: number;
  ibge: string;
  name: string;
  party: string;
}

/** Elected mayors of `cities` (all in one UF) from one consulta_cand CSV. */
export async function parseMayors(chunks: AsyncIterable<string>, cities: City[], election: number): Promise<Mayor[]> {
  const byName = new Map(cities.map((c) => [fold(c.name), c]));
  const out: Mayor[] = [];
  let col: Record<string, number> | null = null;
  let rest = "";
  const take = (line: string) => {
    if (!line.trim()) return;
    const cells = csvLine(line.replace(/\r$/, ""));
    if (!col) {
      col = Object.fromEntries(cells.map((h, i) => [h.trim().toUpperCase(), i]));
      for (const need of ["NM_UE", "DS_CARGO", "DS_SIT_TOT_TURNO", "SG_PARTIDO", "NM_URNA_CANDIDATO"])
        if (!(need in col)) throw new Error(`TSE ${election}: column ${need} missing`);
      return;
    }
    if (fold(cells[col.DS_CARGO]) !== "prefeito" || fold(cells[col.DS_SIT_TOT_TURNO]) !== "eleito") return;
    if ("NM_TIPO_ELEICAO" in col && !/ordinaria/.test(fold(cells[col.NM_TIPO_ELEICAO]))) return;
    const city = byName.get(fold(cells[col.NM_UE]));
    if (!city) return;
    out.push({ election, ibge: city.ibge, name: mayorName(cells[col.NM_URNA_CANDIDATO], cells[col.NM_CANDIDATO]), party: normalizeParty(cells[col.SG_PARTIDO], `${election}-10-01`) ?? "" });
  };
  for await (const c of chunks) {
    rest += c;
    const lines = rest.split("\n");
    rest = lines.pop()!;
    for (const l of lines) take(l);
  }
  take(rest);
  return out;
}

/** The ballot name ("EVANDRO LEITÃO" -> "Evandro Leitão"), or the full name when the ballot name is one word ("LÉO"). */
export function mayorName(ballot: string | undefined, full: string | undefined): string {
  const b = (ballot ?? "").trim();
  return titleCase(b.split(/\s+/).length >= 2 || !full?.trim() ? b : full);
}

export class MayorTable {
  private rows = new Map<string, Mayor[]>();
  constructor(mayors: Mayor[]) {
    for (const m of mayors) {
      if (!this.rows.has(m.ibge)) this.rows.set(m.ibge, []);
      this.rows.get(m.ibge)!.push(m);
    }
  }

  /** The mayor in office in `year` (term = election + 1 .. election + 4), or null when unknown. */
  at(ibge: string, year: number): Executive | null {
    const term = (this.rows.get(ibge) ?? []).filter((m) => m.election + 1 <= year && year <= m.election + 4);
    // Two "eleito" rows for one city and election (a recount or annulled result) leaves it unknown.
    if (term.length !== 1) return null;
    return { name: term[0].name, office: "Prefeito(a)", party: term[0].party || null, basis: "election", election: term[0].election };
  }

  get size() {
    return [...this.rows.values()].flat().length;
  }
}

const CACHE = path.join(process.cwd(), ".cache", "tse");

/** Downloads (or reads from .cache/tse) each municipal election's candidates and keeps the capitals' mayors. */
export async function loadMayors(cities: City[], elections = MUNICIPAL_ELECTIONS): Promise<{ table: MayorTable; info: string[] }> {
  const all: Mayor[] = [];
  const info: string[] = [];
  const ufs = [...new Set(cities.map((c) => c.uf))];
  for (const year of elections.filter((y) => y <= new Date().getUTCFullYear())) {
    const file = path.join(CACHE, `consulta_cand_${year}.zip`);
    let zip: Buffer | null = await readFile(file).catch(() => null);
    if (!zip) {
      try {
        zip = await fetchBuffer(`https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${year}.zip`, { timeoutMs: 900_000 });
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, zip);
      } catch (err) {
        info.push(`TSE ${year}: ${err instanceof HttpError ? `HTTP ${err.status}` : err}`);
        continue;
      }
    }
    let found = 0;
    for (const uf of ufs) {
      try {
        const rows = await parseMayors(zipTextChunks(zip, `_${uf}.csv`, "windows-1252"), cities.filter((c) => c.uf === uf), year);
        found += rows.length;
        all.push(...rows);
      } catch (err) {
        info.push(`TSE ${year} ${uf}: ${err}`);
      }
    }
    info.push(`TSE ${year}: ${found} mayor(s)`);
  }
  return { table: new MayorTable(all), info };
}
