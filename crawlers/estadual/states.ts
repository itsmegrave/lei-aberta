/**
 * The 27 state legislatures (26 Assembleias Legislativas + Câmara Legislativa do DF) and how each one is crawled.
 *
 * adapter:
 *   "sapl"  - the house runs Interlegis SAPL 3.x, whose REST API (/api/norma/normajuridica/) is uniform across houses.
 *   "alesp" - São Paulo's open-data XML dumps (repositorioDados).
 *   null    - no crawler yet; `note` says why. These still get a manifest file with status "planned".
 *
 * `note` is shown in crawlers/estadual/README.md and kept in sync with the coverage table there.
 */
export type Adapter = "sapl" | "alesp" | null;

export interface StateHouse {
  uf: string;
  /** State name, used as the record's `jurisdiction`. */
  state: string;
  /** Short assembly name shown on the site. */
  house: string;
  /** Official https entry point: the API base for crawled houses, the home page otherwise. */
  url: string;
  adapter: Adapter;
  /** Why the house is not crawled (or what is partial). Portuguese, shown on the site. */
  note?: string;
}

const planned = "Ainda sem coleta automática; fonte de dados em estudo.";
const robots = "O robots.txt do site não permite coleta automática da API; aguardando autorização ou outra fonte.";

export const STATES: StateHouse[] = [
  { uf: "AC", state: "Acre", house: "Assembleia Legislativa do Acre", url: "https://sapl.al.ac.leg.br", adapter: "sapl" },
  { uf: "AL", state: "Alagoas", house: "Assembleia Legislativa de Alagoas", url: "https://sapl.al.al.leg.br", adapter: "sapl" },
  { uf: "AP", state: "Amapá", house: "Assembleia Legislativa do Amapá", url: "https://sapl.al.ap.leg.br", adapter: null, note: robots },
  { uf: "AM", state: "Amazonas", house: "Assembleia Legislativa do Amazonas", url: "https://sapl.al.am.leg.br", adapter: "sapl" },
  { uf: "BA", state: "Bahia", house: "Assembleia Legislativa da Bahia", url: "https://www.al.ba.gov.br", adapter: null, note: planned },
  { uf: "CE", state: "Ceará", house: "Assembleia Legislativa do Ceará", url: "https://www.al.ce.gov.br", adapter: null, note: planned },
  { uf: "DF", state: "Distrito Federal", house: "Câmara Legislativa do Distrito Federal", url: "https://www.cl.df.gov.br", adapter: null, note: planned },
  { uf: "ES", state: "Espírito Santo", house: "Assembleia Legislativa do Espírito Santo", url: "https://www.al.es.gov.br", adapter: null, note: planned },
  { uf: "GO", state: "Goiás", house: "Assembleia Legislativa de Goiás", url: "https://portal.al.go.leg.br", adapter: null, note: planned },
  { uf: "MA", state: "Maranhão", house: "Assembleia Legislativa do Maranhão", url: "https://www.al.ma.leg.br", adapter: null, note: planned },
  { uf: "MT", state: "Mato Grosso", house: "Assembleia Legislativa de Mato Grosso", url: "https://www.al.mt.gov.br", adapter: null, note: planned },
  { uf: "MS", state: "Mato Grosso do Sul", house: "Assembleia Legislativa de Mato Grosso do Sul", url: "https://sapl.al.ms.leg.br", adapter: null, note: robots },
  {
    uf: "MG", state: "Minas Gerais", house: "Assembleia Legislativa de Minas Gerais (ALMG)", url: "https://dadosabertos.almg.gov.br/ws/legislacao/ajuda", adapter: null,
    note: "Tem API de legislação, mas o robots.txt não permite coleta automática; aguardando autorização.",
  },
  { uf: "PA", state: "Pará", house: "Assembleia Legislativa do Pará", url: "https://www.alepa.pa.gov.br", adapter: null, note: planned },
  { uf: "PB", state: "Paraíba", house: "Assembleia Legislativa da Paraíba", url: "https://sapl.al.pb.leg.br", adapter: "sapl" },
  { uf: "PR", state: "Paraná", house: "Assembleia Legislativa do Paraná", url: "https://www.assembleia.pr.leg.br", adapter: null, note: planned },
  { uf: "PE", state: "Pernambuco", house: "Assembleia Legislativa de Pernambuco", url: "https://www.alepe.pe.gov.br", adapter: null, note: planned },
  { uf: "PI", state: "Piauí", house: "Assembleia Legislativa do Piauí", url: "https://sapl.al.pi.leg.br", adapter: "sapl" },
  { uf: "RJ", state: "Rio de Janeiro", house: "Assembleia Legislativa do Rio de Janeiro (Alerj)", url: "https://www.alerj.rj.gov.br", adapter: null, note: planned },
  { uf: "RN", state: "Rio Grande do Norte", house: "Assembleia Legislativa do Rio Grande do Norte", url: "https://www.al.rn.leg.br", adapter: null, note: planned },
  { uf: "RS", state: "Rio Grande do Sul", house: "Assembleia Legislativa do Rio Grande do Sul", url: "https://www.al.rs.gov.br", adapter: null, note: planned },
  { uf: "RO", state: "Rondônia", house: "Assembleia Legislativa de Rondônia", url: "https://sapl.al.ro.leg.br", adapter: "sapl" },
  {
    uf: "RR", state: "Roraima", house: "Assembleia Legislativa de Roraima", url: "https://sapl.al.rr.leg.br", adapter: null,
    note: "Usa SAPL, mas a API recusa acesso automático (HTTP 403); aguardando autorização.",
  },
  { uf: "SC", state: "Santa Catarina", house: "Assembleia Legislativa de Santa Catarina (Alesc)", url: "https://www.alesc.sc.gov.br", adapter: null, note: planned },
  {
    uf: "SP", state: "São Paulo", house: "Assembleia Legislativa de São Paulo (Alesp)", url: "https://www.al.sp.gov.br/dados-abertos/", adapter: "alesp",
    note: "Leis, leis complementares e emendas à Constituição do estado, com autores. Como a Alesp não publica o histórico de filiação, o partido do deputado é o da eleição (dados do TSE).",
  },
  { uf: "SE", state: "Sergipe", house: "Assembleia Legislativa de Sergipe", url: "https://sapl.al.se.leg.br", adapter: null, note: robots },
  { uf: "TO", state: "Tocantins", house: "Assembleia Legislativa do Tocantins", url: "https://sapl.al.to.leg.br", adapter: "sapl" },
];

export const sourceId = (uf: string) => `assembleia-${uf.toLowerCase()}`;
export const byUf = (uf: string) => STATES.find((s) => s.uf === uf.toUpperCase());
