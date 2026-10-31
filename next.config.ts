import type { NextConfig } from "next";
import { SITE_URL } from "./lib/share.ts";

// Served by Vercel. The home page, data files and sitemaps are prerendered at build time.
// Law pages, short links and share images (one each per law, tens of thousands) render on
// first request and are then cached, so the build stays fast however big the catalog grows.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Resolve the site address once at build time so server and browser code agree on it.
  env: { NEXT_PUBLIC_SITE_URL: SITE_URL },
  // Files read with fs at request time, which the bundler cannot see on its own.
  outputFileTracingIncludes: {
    "/lei/[id]": ["./data/**/*.json"],
    "/lei/[id]/opengraph-image": ["./data/**/*.json", "./assets/og-emoji/**", "./node_modules/@fontsource/**/files/*-latin-{700,800}-normal.woff"],
    "/l/[code]": ["./data/**/*.json"],
  },
};

export default nextConfig;
