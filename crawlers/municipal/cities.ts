/**
 * The 26 state capitals and how each Câmara Municipal is crawled.
 *
 * adapter:
 *   "sapl" - the câmara runs Interlegis SAPL 3.x (same REST API as the state assemblies, see crawlers/estadual/sapl.ts).
 *   "cmsp" - São Paulo's own web service (splegisws.saopaulo.sp.leg.br).
 *   null   - no crawler yet; `note` says why. These still get a manifest with status "planned", and their laws can
 *            still arrive from the Diários Oficiais crawler (Querido Diário), without authors.
 *
 * Brasília is not here: the Distrito Federal has no municipalities, and its laws (leis distritais) come from the
 * Câmara Legislativa do DF, which the state crawler lists.
 *
 * Checked on 2026-11-03. `note` is shown on the site and kept in sync with the table in README.md.
 */
export type Adapter = "sapl" | "cmsp" | null;

export interface City {
  /** IBGE municipality code; part of every record id. */
  ibge: string;
  name: string;
  uf: string;
  /** Short câmara name shown on the site. */
  house: string;
  /** Official https entry point: the API base for crawled câmaras, the home page otherwise. */
  url: string;
  adapter: Adapter;
  /** Portuguese, shown on the site. */
  note?: string;
}

const planned = "Ainda sem coleta automática da Câmara; fonte de dados em estudo. Leis publicadas no Diário Oficial chegam pelo Querido Diário, sem autores.";

export const CITIES: City[] = [
  { ibge: "1100205", name: "Porto Velho", uf: "RO", house: "Câmara Municipal de Porto Velho", url: "https://sapl.portovelho.ro.leg.br", adapter: "sapl" },
  { ibge: "1200401", name: "Rio Branco", uf: "AC", house: "Câmara Municipal de Rio Branco", url: "https://sapl.riobranco.ac.leg.br", adapter: "sapl" },
  { ibge: "1302603", name: "Manaus", uf: "AM", house: "Câmara Municipal de Manaus", url: "https://sapl.cmm.am.gov.br", adapter: "sapl" },
  { ibge: "1400100", name: "Boa Vista", uf: "RR", house: "Câmara Municipal de Boa Vista", url: "https://sapl.boavista.rr.leg.br", adapter: "sapl" },
  { ibge: "1501402", name: "Belém", uf: "PA", house: "Câmara Municipal de Belém", url: "https://www.cmb.pa.gov.br", adapter: null, note: planned },
  { ibge: "1600303", name: "Macapá", uf: "AP", house: "Câmara Municipal de Macapá", url: "https://www.macapa.ap.leg.br", adapter: null, note: planned },
  {
    ibge: "1721000", name: "Palmas", uf: "TO", house: "Câmara Municipal de Palmas", url: "https://sapl.palmas.to.leg.br", adapter: "sapl",
    note: "A Câmara de Palmas começou a usar o sistema em 2023 e ainda tem poucas leis cadastradas.",
  },
  { ibge: "2111300", name: "São Luís", uf: "MA", house: "Câmara Municipal de São Luís", url: "https://www.cmsaoluis.ma.gov.br", adapter: null, note: planned },
  { ibge: "2211001", name: "Teresina", uf: "PI", house: "Câmara Municipal de Teresina", url: "https://www.teresina.pi.leg.br", adapter: null, note: planned },
  { ibge: "2304400", name: "Fortaleza", uf: "CE", house: "Câmara Municipal de Fortaleza", url: "https://sapl.fortaleza.ce.leg.br", adapter: "sapl" },
  { ibge: "2408102", name: "Natal", uf: "RN", house: "Câmara Municipal de Natal", url: "https://sapl.natal.rn.leg.br", adapter: "sapl" },
  { ibge: "2507507", name: "João Pessoa", uf: "PB", house: "Câmara Municipal de João Pessoa", url: "https://sapl.joaopessoa.pb.leg.br", adapter: "sapl" },
  { ibge: "2611606", name: "Recife", uf: "PE", house: "Câmara Municipal do Recife", url: "https://sapl.recife.pe.leg.br", adapter: "sapl" },
  { ibge: "2704302", name: "Maceió", uf: "AL", house: "Câmara Municipal de Maceió", url: "https://www.maceio.al.leg.br", adapter: null, note: planned },
  { ibge: "2800308", name: "Aracaju", uf: "SE", house: "Câmara Municipal de Aracaju", url: "https://www.aracaju.se.leg.br", adapter: null, note: planned },
  { ibge: "2927408", name: "Salvador", uf: "BA", house: "Câmara Municipal de Salvador", url: "https://www.cms.ba.gov.br", adapter: null, note: planned },
  { ibge: "3106200", name: "Belo Horizonte", uf: "MG", house: "Câmara Municipal de Belo Horizonte", url: "https://www.cmbh.mg.gov.br", adapter: null, note: planned },
  { ibge: "3205309", name: "Vitória", uf: "ES", house: "Câmara Municipal de Vitória", url: "https://www.cmv.es.gov.br", adapter: null, note: planned },
  { ibge: "3304557", name: "Rio de Janeiro", uf: "RJ", house: "Câmara Municipal do Rio de Janeiro", url: "https://www.camara.rio", adapter: null, note: planned },
  {
    ibge: "3550308", name: "São Paulo", uf: "SP", house: "Câmara Municipal de São Paulo", url: "https://splegisws.saopaulo.sp.leg.br/ws/ws2.asmx", adapter: "cmsp",
    note: "Leis aprovadas na Câmara de São Paulo, com autores e o partido de cada vereador na época (histórico de filiação da própria Câmara).",
  },
  { ibge: "4106902", name: "Curitiba", uf: "PR", house: "Câmara Municipal de Curitiba", url: "https://www.cmc.pr.gov.br", adapter: null, note: planned },
  { ibge: "4205407", name: "Florianópolis", uf: "SC", house: "Câmara Municipal de Florianópolis", url: "https://www.cmf.sc.gov.br", adapter: null, note: planned },
  { ibge: "4314902", name: "Porto Alegre", uf: "RS", house: "Câmara Municipal de Porto Alegre", url: "https://www.camarapoa.rs.gov.br", adapter: null, note: planned },
  { ibge: "5002704", name: "Campo Grande", uf: "MS", house: "Câmara Municipal de Campo Grande", url: "https://www.camara.ms.gov.br", adapter: null, note: planned },
  { ibge: "5103403", name: "Cuiabá", uf: "MT", house: "Câmara Municipal de Cuiabá", url: "https://www.camaracuiaba.mt.gov.br", adapter: null, note: planned },
  { ibge: "5208707", name: "Goiânia", uf: "GO", house: "Câmara Municipal de Goiânia", url: "https://www.goiania.go.leg.br", adapter: null, note: planned },
];

/** Manifest id: data/sources/camara-municipal-<slug>.json. */
export function sourceId(c: Pick<City, "name">): string {
  const slug = c.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `camara-municipal-${slug}`;
}

/** Matches an IBGE code, a city name ("joao pessoa", "João Pessoa") or a UF of a capital ("PB"). */
export function findCity(key: string): City | undefined {
  const k = key.trim();
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CITIES.find((c) => c.ibge === k || c.uf === k.toUpperCase() || fold(c.name) === fold(k) || sourceId(c) === `camara-municipal-${fold(k).replace(/[^a-z0-9]+/g, "-")}`);
}
