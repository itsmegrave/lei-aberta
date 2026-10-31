/**
 * Party of a state deputy at election time, from TSE's open candidate data (consulta_cand_<year>.zip,
 * one CSV per UF, ";"-separated, Latin-1). Used for houses that publish author names but no affiliation
 * history (Alesp): the party is the one under which the author ran in the last state election before the law.
 *
 * This is the party "when elected", which can differ from the party on the bill's date if the deputy switched
 * mid-term. Records say so in the author's `partySource`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fold } from "./common.ts";
import { HttpError, fetchBuffer } from "./http.ts";
import { zipTextChunks } from "./zip.ts";

/** State legislature elections since the 1988 Constitution. */
export const STATE_ELECTIONS = [1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026];

export interface Candidacy {
  year: number;
  name: string;
  ballotName: string;
  party: string;
  elected: boolean;
  /** Suplentes can take a seat later and author bills. */
  substitute: boolean;
}

const ELECTED = /^(eleito|eleito por qp|eleito por media|media)$/;

/** Splits one ";"-separated CSV line with "..." quoting. */
export function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ";") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Reads state-deputy candidacies of one UF out of a consulta_cand CSV (as text chunks). */
export async function parseCandidates(chunks: AsyncIterable<string>, uf: string, year: number): Promise<Candidacy[]> {
  const out: Candidacy[] = [];
  let header: string[] | null = null;
  let col: Record<string, number> = {};
  let rest = "";
  const take = (line: string) => {
    if (!line.trim()) return;
    const cells = csvLine(line.replace(/\r$/, ""));
    if (!header) {
      header = cells.map((h) => h.trim().toUpperCase());
      col = Object.fromEntries(header.map((h, i) => [h, i]));
      for (const need of ["SG_UF", "DS_CARGO", "NM_CANDIDATO", "SG_PARTIDO"])
        if (!(need in col)) throw new Error(`TSE ${year}: column ${need} missing (header: ${header.slice(0, 12).join(",")})`);
      return;
    }
    if (cells[col.SG_UF] !== uf || fold(cells[col.DS_CARGO]) !== "deputado estadual") return;
    const sit = fold(cells[col.DS_SIT_TOT_TURNO] ?? "");
    out.push({
      year,
      name: cells[col.NM_CANDIDATO],
      ballotName: cells[col.NM_URNA_CANDIDATO] ?? "",
      party: cells[col.SG_PARTIDO],
      elected: ELECTED.test(sit),
      substitute: sit === "suplente",
    });
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

/** "Deputada Fulana de Tal" / "FULANA DE TAL" -> "fulana de tal". */
export function personKey(name: string): string {
  return fold(name)
    .replace(/^(deputad[oa]|dep\.?|dr\.?|dra\.?)\s+/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class PartyAtElection {
  private byKey = new Map<string, Candidacy[]>();

  constructor(candidacies: Candidacy[]) {
    for (const c of candidacies) {
      if (!c.elected && !c.substitute) continue;
      for (const k of new Set([personKey(c.ballotName), personKey(c.name)])) {
        if (!k) continue;
        if (!this.byKey.has(k)) this.byKey.set(k, []);
        this.byKey.get(k)!.push(c);
      }
    }
  }

  /**
   * Party under which `name` was elected (or ran as suplente) in the last state election whose legislature had
   * begun by `date` (legislatures start in February of the year after the election). Null when the name matches
   * nobody, or two different people with different parties in that election.
   */
  partyFor(name: string, date: string | null): { party: string; election: number } | null {
    if (!date) return null;
    const rows = this.byKey.get(personKey(name));
    if (!rows) return null;
    const year = Number(date.slice(0, 4));
    const started = (e: number) => year > e + 1 || (year === e + 1 && date.slice(5) >= "02-01");
    const elections = [...new Set(rows.map((r) => r.year))].filter(started).sort((a, b) => b - a);
    const e = elections[0];
    if (e === undefined) return null;
    const inE = rows.filter((r) => r.year === e);
    const pick = inE.some((r) => r.elected) ? inE.filter((r) => r.elected) : inE;
    const parties = new Set(pick.map((r) => r.party));
    return parties.size === 1 ? { party: [...parties][0], election: e } : null;
  }
}

const CACHE = path.join(process.cwd(), ".cache", "tse");

/** Downloads (or reads from .cache/tse) the candidate zip of each election, keeping one UF's state deputies. */
export async function loadPartyAtElection(uf: string, elections = STATE_ELECTIONS): Promise<{ table: PartyAtElection; info: string[] }> {
  const all: Candidacy[] = [];
  const info: string[] = [];
  const thisYear = new Date().getUTCFullYear();
  for (const year of elections.filter((y) => y <= thisYear)) {
    const file = path.join(CACHE, `consulta_cand_${year}.zip`);
    let zip: Buffer | null = await readFile(file).catch(() => null);
    if (!zip) {
      try {
        zip = await fetchBuffer(`https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${year}.zip`, { timeoutMs: 900_000 });
        // Past elections never change; keep them for the next run (cached by the workflow).
        if (year < thisYear) {
          await mkdir(CACHE, { recursive: true });
          await writeFile(file, zip);
        }
      } catch (err) {
        info.push(`TSE ${year}: ${err instanceof HttpError ? `HTTP ${err.status}` : err}`);
        continue;
      }
    }
    try {
      const rows = await parseCandidates(zipTextChunks(zip, `_${uf}.csv`), uf, year);
      info.push(`TSE ${year}: ${rows.length} candidacies, ${rows.filter((r) => r.elected).length} elected`);
      all.push(...rows);
    } catch (err) {
      info.push(`TSE ${year}: ${err}`);
    }
  }
  return { table: new PartyAtElection(all), info };
}
