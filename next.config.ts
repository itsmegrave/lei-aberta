import type { NextConfig } from "next";

// Static export: the site is plain files, so any static host (Vercel, GitHub Pages) can serve it.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
