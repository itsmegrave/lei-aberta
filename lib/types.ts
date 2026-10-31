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
  /** Date the law was signed or the MP issued (YYYY-MM-DD). */
  signedAt?: string | null;
  /** Bill that became this law, as numbered in the house where it started, e.g. "PL 3561/1997". */
  bill?: string | null;
  /** Laws: "sancionada". MPs: em-tramitacao, convertida, rejeitada, perdeu-eficacia, revogada. */
  status: string;
  areas: string[];
  authors: Author[];
  parties: string[];
  executive?: Executive | null;
  sources: { label: string; url: string }[];
  /** MPs only: number of reissues before EC 32/2001. */
  reissues?: number;
  /** MPs only: id of the law the MP was converted into. */
  convertedInto?: string;
  /** Title, summary and areas were written by hand; crawlers keep them. */
  curated?: boolean;
}
