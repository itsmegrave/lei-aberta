import { loadCatalog } from "@/lib/data";
import { readSources } from "@/lib/sources-store";
import { sortSources } from "@/lib/sources";
import { Home } from "@/components/home/home";

export default async function Page() {
  const [{ policies, updatedAt, sample }, sources] = await Promise.all([loadCatalog(), readSources()]);
  return <Home policies={policies} updatedAt={updatedAt} sample={sample} sources={sortSources(sources)} />;
}
