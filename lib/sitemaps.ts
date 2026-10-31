import "server-only";
import { loadCatalog } from "./data";
import { lawPath } from "./share";
import { sitemapChunks, type SitemapUrl } from "./seo";

/** Sitemap files listed by /sitemap.xml: the site's own pages, then the laws in chunks. */
export async function sitemapFiles(): Promise<{ name: string; lastmod: string; urls: SitemapUrl[] }[]> {
  const { policies, updatedAt } = await loadCatalog();
  const pages = { name: "paginas.xml", lastmod: updatedAt, urls: [{ path: "/", lastmod: updatedAt, image: "/opengraph-image" }] };
  const laws = sitemapChunks(policies).map((chunk, i) => ({
    name: `leis-${i + 1}.xml`,
    lastmod: updatedAt,
    urls: chunk.map((p) => ({ path: lawPath(p.id), lastmod: updatedAt, image: `${lawPath(p.id)}/opengraph-image` })),
  }));
  return [pages, ...laws];
}
