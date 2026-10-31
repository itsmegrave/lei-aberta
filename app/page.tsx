import { loadCatalog } from "@/lib/data";
import { shortUrl } from "@/lib/share";
import { readSources } from "@/lib/sources-store";
import { sortSources } from "@/lib/sources";
import { Home } from "@/components/home/home";

export default async function Page() {
  const [{ policies, updatedAt, sample }, sources] = await Promise.all([loadCatalog(), readSources()]);
  // Slim client payload: drop fields the page never shows.
  const slim = policies.map(({ presentedAt: _p, reissues: _r, curated: _c, ...rest }) => ({ ...rest, presentedAt: null, shareUrl: shortUrl(rest.id) }));
  return <Home policies={slim} updatedAt={updatedAt} sample={sample} sources={sortSources(sources)} />;
}
