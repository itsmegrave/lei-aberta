import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/share";

export const dynamic = "force-static";

// Vercel preview builds (and any non-production build on Vercel) stay out of search results.
const indexable = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

export default function robots(): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
