import type { Metadata } from "next";
import { Results } from "@/components/search/results";
import { loadListing } from "@/lib/data";
import { SEARCH_PATH } from "@/lib/listing";
import { SITE_NAME } from "@/lib/seo";

const TITLE = "Buscar leis";
const DESCRIPTION = "Busque leis do Brasil por palavra, tema, nível de governo, partido, estado ou ano, cada uma com o link para o texto oficial.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SEARCH_PATH },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", title: TITLE, description: DESCRIPTION, url: SEARCH_PATH },
};

// Prerendered with page 1 and the unfiltered numbers; the filters in the address bar apply in the browser.
export default async function SearchPage() {
  const listing = await loadListing();
  return <Results firstPage={listing.page(1)} overview={listing.overview} pages={listing.pages} lastYear={listing.lastYear} />;
}
