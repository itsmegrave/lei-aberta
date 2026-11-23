// Response caching on Vercel's CDN, instead of Next.js ISR.
//
// ISR stores every rendered page, RSC payload and image in Vercel's ISR cache, and each write is billed in 8 KB
// units (a law page plus its share image is about 25 units). The Hobby plan includes 200,000 writes a month, and
// the daily deploy empties the cache, so crawlers visiting tens of thousands of law pages used it up.
// The CDN cache below costs nothing per write: a response is rendered by the function on a miss and served
// from the CDN until it expires or the next deploy. Vercel reads Vercel-CDN-Cache-Control and does not pass it
// on to browsers, and Next.js does not overwrite it the way it does Cache-Control on pages.

export const CDN_CACHE_HEADER = "Vercel-CDN-Cache-Control";

/** CDN cache directive: fresh for maxAge seconds, then served stale while one request refreshes it. */
export const cdnCache = (maxAge: number, staleWhileRevalidate = maxAge) =>
  `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;

/** Law pages, short links and share images: the catalog only changes with a deploy, which clears the CDN cache. */
export const LAW_CACHE = cdnCache(7 * 24 * 3600, 24 * 3600);
/** Crawl status for the "Fontes" cards, which poll it every minute. */
export const STATUS_CACHE = cdnCache(60);
/** News feeds on the home page. */
export const NEWS_CACHE = cdnCache(1800);

/** Headers for a route handler response cached on the CDN only (browsers always ask again). */
export const cdnHeaders = (directive: string): Record<string, string> => ({
  [CDN_CACHE_HEADER]: directive,
  "Cache-Control": "public, max-age=0, must-revalidate",
});
