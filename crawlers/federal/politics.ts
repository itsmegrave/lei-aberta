// Time-aware party names and the head of the federal executive.

/**
 * The Senado and Câmara APIs often report a party under its current name even for old dates
 * (e.g. "MDB" for a 1989 bill). These are formal renames of the same registered party, so we
 * map the current name back to the name in use on the given date. Mergers are not renames and
 * are not listed. Dates are when the TSE approved the change (to the month when unsure).
 */
const RENAMES: Record<string, { before: string; name: string }[]> = {
  // Each list goes from newest to oldest change.
  MDB: [{ before: "2017-12-19", name: "PMDB" }],
  DEM: [{ before: "2007-03-28", name: "PFL" }],
  Agir: [
    { before: "2022-05-01", name: "PTC" },
    { before: "2000-02-01", name: "PRN" },
  ],
  PTC: [{ before: "2000-02-01", name: "PRN" }],
  Progressistas: [
    { before: "2017-08-01", name: "PP" },
    { before: "2003-04-01", name: "PPB" },
  ],
  PP: [{ before: "2003-04-01", name: "PPB" }],
  Cidadania: [{ before: "2019-03-23", name: "PPS" }],
  Republicanos: [{ before: "2019-08-01", name: "PRB" }],
  // The current PL is the former PR (2006-2019). Before the 2006 merger, "PL" was the old PL.
  PL: [{ before: "2019-05-07", name: "PR" }],
  Podemos: [{ before: "2017-05-01", name: "PTN" }],
  PODE: [{ before: "2017-05-01", name: "PTN" }],
  Avante: [{ before: "2017-09-01", name: "PTdoB" }],
  Patriota: [{ before: "2018-04-01", name: "PEN" }],
  DC: [{ before: "2017-08-01", name: "PSDC" }],
};
const PL_MERGER = "2006-10-26";

export function partyNameAt(sigla: string | null | undefined, date: string | null | undefined): string | null {
  const s = sigla?.trim();
  if (!s || s === "S/PARTIDO" || s === "S.PART." || s === "SEM PARTIDO" || s === "/") return null;
  if (!date) return s;
  if (s === "PL" && date < PL_MERGER) return "PL";
  let name = s;
  for (const r of RENAMES[s] ?? []) if (date < r.before) name = r.name;
  return name;
}

export interface ExecutiveTerm {
  name: string;
  from: string; // inclusive, YYYY-MM-DD
  to: string; // exclusive
  /** Party affiliation over the term, newest last. null = no party. */
  parties: { from: string; party: string | null }[];
}

/**
 * Holders of the presidency since 1985. A law is attributed to the holder of the office on the
 * signature date; an acting president (e.g. the vice president during a trip) is not tracked.
 * Sources: Biblioteca da Presidência da República, galeria de presidentes
 * (https://www.gov.br/planalto/pt-br/conheca-a-presidencia/biblioteca-da-presidencia).
 */
export const PRESIDENTS: ExecutiveTerm[] = [
  { name: "José Sarney", from: "1985-03-15", to: "1990-03-15", parties: [{ from: "1985-03-15", party: "PMDB" }] },
  { name: "Fernando Collor", from: "1990-03-15", to: "1992-10-02", parties: [{ from: "1990-03-15", party: "PRN" }] },
  // Interim from 1992-10-02 (Collor's removal), president from 1992-12-29. Itamar had left the PRN and held no party.
  { name: "Itamar Franco", from: "1992-10-02", to: "1995-01-01", parties: [{ from: "1992-10-02", party: null }] },
  { name: "Fernando Henrique Cardoso", from: "1995-01-01", to: "2003-01-01", parties: [{ from: "1995-01-01", party: "PSDB" }] },
  { name: "Luiz Inácio Lula da Silva", from: "2003-01-01", to: "2011-01-01", parties: [{ from: "2003-01-01", party: "PT" }] },
  { name: "Dilma Rousseff", from: "2011-01-01", to: "2016-05-12", parties: [{ from: "2011-01-01", party: "PT" }] },
  // Interim from 2016-05-12 (Dilma's suspension), president from 2016-08-31.
  {
    name: "Michel Temer",
    from: "2016-05-12",
    to: "2019-01-01",
    parties: [
      { from: "2016-05-12", party: "PMDB" },
      { from: "2017-12-19", party: "MDB" },
    ],
  },
  {
    name: "Jair Bolsonaro",
    from: "2019-01-01",
    to: "2023-01-01",
    parties: [
      { from: "2019-01-01", party: "PSL" },
      { from: "2019-11-19", party: null },
      { from: "2021-11-30", party: "PL" },
    ],
  },
  { name: "Luiz Inácio Lula da Silva", from: "2023-01-01", to: "9999-12-31", parties: [{ from: "2023-01-01", party: "PT" }] },
];

export function presidentAt(date: string): { name: string; office: string; party: string | null } | null {
  const term = PRESIDENTS.find((t) => date >= t.from && date < t.to);
  if (!term) return null;
  let party: string | null = null;
  for (const p of term.parties) if (date >= p.from) party = p.party;
  return { name: term.name, office: "Presidente", party };
}

/** Câmara legislatures are four years starting Feb 1; the 48th began in 1987. */
export function legislatureAt(date: string): number {
  const y = Number(date.slice(0, 4));
  const startYear = date.slice(5) >= "02-01" ? y : y - 1;
  return 48 + Math.floor((startYear - 1987) / 4);
}
