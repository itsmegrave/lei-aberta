import type { NextConfig } from "next";
import { CDN_CACHE_HEADER, LAW_CACHE } from "./lib/cdn-cache.ts";
import { SITE_URL } from "./lib/share.ts";

// Served by Vercel. The home page, data files and sitemaps are prerendered at build time.
// Law pages, short links and share images (one each per law, tens of thousands) render on request
// and are cached on Vercel's CDN, not with ISR (see lib/cdn-cache.ts), so the build stays fast
// however big the catalog grows and crawlers do not use up the free plan's ISR writes.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Resolve the site address once at build time so server and browser code agree on it.
  env: { NEXT_PUBLIC_SITE_URL: SITE_URL },
  // Files read with fs at request time, which the bundler cannot see on its own.
  outputFileTracingIncludes: {
    "/lei/[id]": ["./data/**/*.json"],
    "/lei/[id]/opengraph-image": ["./data/**/*.json", "./assets/og-emoji/**", "./node_modules/@fontsource/**/files/*-latin-{700,800}-normal.woff"],
    "/l/[code]": ["./data/**/*.json"],
    "/api/coletas": ["./data/status/*.json"],
  },
  // Pages cannot set response headers themselves, and Next.js overwrites Cache-Control on them.
  // The share images set theirs in app/lei/[id]/opengraph-image.tsx.
  async headers() {
    const cdn = [{ key: CDN_CACHE_HEADER, value: LAW_CACHE }];
    return [
      { source: "/lei/:id", headers: cdn },
      { source: "/l/:code", headers: cdn },
    ];
  },
};

export default nextConfig;
