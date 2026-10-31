import { loadCatalog } from "@/lib/data";
import { Home } from "@/components/home/home";

export default async function Page() {
  const { policies, updatedAt, sample } = await loadCatalog();
  return <Home policies={policies} updatedAt={updatedAt} sample={sample} />;
}
