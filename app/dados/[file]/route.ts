import { loadListing } from "@/lib/data";
import { pageFile } from "@/lib/listing";

// Static JSON the home page loads on demand: /dados/indice.json and /dados/pagina-<n>.json (see lib/listing.ts).
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const { pages } = await loadListing();
  return [{ file: "indice.json" }, ...Array.from({ length: pages }, (_, i) => ({ file: pageFile(i + 1) }))];
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const listing = await loadListing();
  if (file === "indice.json") return Response.json(listing.index());
  const m = /^pagina-(\d+)\.json$/.exec(file);
  const n = m ? Number(m[1]) : 0;
  if (n < 1 || n > listing.pages) return new Response("Not found", { status: 404 });
  return Response.json(listing.page(n));
}
