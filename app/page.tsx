import { loadListing } from "@/lib/data";
import { readSources } from "@/lib/sources-store";
import { sortSources } from "@/lib/sources";
import { area } from "@/lib/vocab";
import { Home } from "@/components/home/home";
import { JsonLd } from "@/components/seo/json-ld";
import { siteJsonLd } from "@/lib/seo";

export default async function Page() {
  const [listing, sources] = await Promise.all([loadListing(), readSources()]);
  // The home ships only the unfiltered numbers and a few titles for the ticker; the laws are listed on /busca.
  const ticker = listing.page(1).slice(0, 20).map((p) => ({ title: p.title, year: p.year, emoji: area(p.areas[0]).emoji }));
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <Home overview={listing.overview} ticker={ticker} sample={listing.sample} sources={sortSources(sources)} />
    </>
  );
}
