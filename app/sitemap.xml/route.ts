import { sitemapIndexXml } from "@/lib/seo";
import { sitemapFiles } from "@/lib/sitemaps";

// Sitemap index: the catalog can hold tens of thousands of laws, more than one sitemap file allows.
export const dynamic = "force-static";

export async function GET() {
  const files = await sitemapFiles();
  const lastmod = files.reduce((m, f) => (f.lastmod > m ? f.lastmod : m), "");
  return new Response(sitemapIndexXml(files.map((f) => `/sitemaps/${f.name}`), lastmod), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
