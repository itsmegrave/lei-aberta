export type Level = "federal" | "estadual" | "municipal";

export interface Author {
  name: string;
  kind: "executive" | "senator" | "deputy" | "state-deputy" | "councilor" | string;
  /** Author's party at the time of authorship. */
  party: string | null;
  uf: string | null;
}

/** Head of the executive (president, governor, mayor) who signed the law. Never merged with author party. */
export interface Executive {
  name: string;
  office: string;
  party: string | null;
}

export interface Policy {
  id: string;
  level: Level;
  jurisdiction: string;
  type: string;
  number?: string;
  title: string;
  summary: string;
  year: number;
  presentedAt: string | null;
  status: string;
  areas: string[];
  authors: Author[];
  parties: string[];
  executive?: Executive | null;
  sources: { label: string; url: string }[];
  /** Date the executive signed it (ISO date). */
  signedAt?: string | null;
  /** Originating bill, e.g. "PL 3561/1997". */
  bill?: string | null;
  /** For an MP issued before EC 32/2001: how many times it was reissued (one record covers all editions). */
  reissues?: number | null;
  /** For an MP: id of the law it became. */
  convertedInto?: string | null;
  /** Hand-checked record. */
  curated?: boolean;
}
