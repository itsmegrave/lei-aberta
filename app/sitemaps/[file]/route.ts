import { urlsetXml } from "@/lib/seo";
import { sitemapFiles } from "@/lib/sitemaps";

// One file per chunk of laws (/sitemaps/leis-1.xml, ...), listed by /sitemap.xml.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await sitemapFiles()).map((f) => ({ file: f.name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const found = (await sitemapFiles()).find((f) => f.name === file);
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(found.urls), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
