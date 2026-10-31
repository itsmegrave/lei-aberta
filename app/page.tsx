import { loadListing } from "@/lib/data";
import { readSources } from "@/lib/sources-store";
import { sortSources } from "@/lib/sources";
import { Home } from "@/components/home/home";
import { JsonLd } from "@/components/seo/json-ld";
import { siteJsonLd } from "@/lib/seo";

export default async function Page() {
  const [listing, sources] = await Promise.all([loadListing(), readSources()]);
  // Ship only page 1 and the unfiltered numbers; other pages and the filter index load on demand.
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <Home
        firstPage={listing.page(1)}
        overview={listing.overview}
        pages={listing.pages}
        lastYear={listing.lastYear}
        sample={listing.sample}
        sources={sortSources(sources)}
      />
    </>
  );
}
