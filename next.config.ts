import type { NextConfig } from "next";
import { SITE_URL } from "./lib/share.ts";

// Static export: the site is plain files, so any static host (Vercel, GitHub Pages) can serve it.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Resolve the site address once at build time so server and browser code agree on it.
  env: { NEXT_PUBLIC_SITE_URL: SITE_URL },
};

export default nextConfig;
