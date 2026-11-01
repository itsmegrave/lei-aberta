import { fetchNews, mixNews, NEWS_OUTLETS, withUtm } from "@/lib/news";

// Rebuilt on the server at most every 30 minutes and served from cache in between,
// so the feeds are read a few dozen times a day and no deploy is needed to refresh them.
export const revalidate = 1800;

export async function GET() {
  const { items, failed } = await fetchNews();
  return Response.json({
    items: mixNews(items).map((i) => ({ ...i, url: withUtm(i.url) })),
    outlets: NEWS_OUTLETS.map((o) => o.name),
    failed,
    updatedAt: new Date().toISOString(),
  });
}
