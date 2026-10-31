/** Public site address, used for canonical links, share images and Dub targets. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lei-aberta.vercel.app").replace(/\/+$/, "");

/** Path of a law's own page. Ids are already URL-safe (letters, digits, dashes). */
export const lawPath = (id: string) => `/lei/${encodeURIComponent(id)}`;
export const lawUrl = (id: string, base = SITE_URL) => `${base}${lawPath(id)}`;

/** Map of law id to Dub short link, kept in data/short-links.json by scripts/short-links.ts. */
export type ShortLinks = Record<string, string>;

/** Link to share: the Dub short link when one exists, otherwise the law's full page URL. */
export const shareUrl = (id: string, links: ShortLinks, base = SITE_URL) => links[id] || lawUrl(id, base);
