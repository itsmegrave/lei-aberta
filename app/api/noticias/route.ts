import { cdnHeaders, NEWS_CACHE } from "@/lib/cdn-cache";
import { fetchNews, mixNews, NEWS_OUTLETS, withUtm } from "@/lib/news";

// Rebuilt on the server at most every 30 minutes and served from the CDN cache in between (not ISR, whose
// writes the free plan caps), so the feeds are read a few dozen times a day and no deploy is needed to refresh them.
export const dynamic = "force-dynamic";

export async function GET() {
  const { items, failed } = await fetchNews();
  return Response.json({
    items: mixNews(items).map((i) => ({ ...i, url: withUtm(i.url) })),
    outlets: NEWS_OUTLETS.map((o) => o.name),
    failed,
    updatedAt: new Date().toISOString(),
  }, { headers: cdnHeaders(NEWS_CACHE) });
}
