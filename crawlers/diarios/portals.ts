/**
 * Official city-hall sites for the capitals, keyed by IBGE code.
 *
 * Querido Diário links point to its own copy of each gazette (on ok.org.br), which is faithful but
 * not an official domain. Every record also needs an official link, so municipal records carry the
 * city's own portal as a second source. Each run checks that the portal answers before using it;
 * records from a city whose portal is down or unknown are skipped, never published without an
 * official link.
 */
export const PORTALS: Record<string, string> = {
  "1100205": "https://www.portovelho.ro.gov.br",
  "1200401": "https://www.riobranco.ac.gov.br",
  "1302603": "https://dom.manaus.am.gov.br",
  "1400100": "https://boavista.rr.gov.br",
  "1501402": "https://www.belem.pa.gov.br",
  "1600303": "https://macapa.ap.gov.br",
  "1721000": "https://diariooficial.palmas.to.gov.br",
  "2111300": "https://www.saoluis.ma.gov.br",
  "2211001": "https://dom.pmt.pi.gov.br",
  "2304400": "https://diariooficial.fortaleza.ce.gov.br",
  "2408102": "https://www.natal.rn.gov.br/dom",
  "2507507": "https://www.joaopessoa.pb.gov.br",
  "2611606": "https://www.recife.pe.gov.br",
  "2704302": "https://www.maceio.al.gov.br",
  "2800308": "https://www.aracaju.se.gov.br",
  "2927408": "https://www.dom.salvador.ba.gov.br",
  "3106200": "https://dom-web.pbh.gov.br",
  "3205309": "https://diariooficial.vitoria.es.gov.br",
  "3304557": "https://doweb.rio.rj.gov.br",
  "3550308": "https://diariooficial.prefeitura.sp.gov.br",
  "4106902": "https://www.curitiba.pr.gov.br",
  "4205407": "https://www.pmf.sc.gov.br",
  "4314902": "https://dopa.portoalegre.rs.gov.br",
  "5002704": "https://www.campogrande.ms.gov.br",
  "5103403": "https://www.cuiaba.mt.gov.br",
  "5208707": "https://www.goiania.go.gov.br",
};

export function portalSource(territoryId: string, cityName: string): { label: string; url: string } | null {
  const url = PORTALS[territoryId];
  return url ? { label: `Prefeitura de ${cityName}: portal oficial`, url } : null;
}
