/** Public site address, used for canonical links, share images and short links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lei-aberta.vercel.app").replace(/\/+$/, "");

/** Path of a law's own page. Ids are already URL-safe (letters, digits, dashes). */
export const lawPath = (id: string) => `/lei/${encodeURIComponent(id)}`;
export const lawUrl = (id: string, base = SITE_URL) => `${base}${lawPath(id)}`;

const CODE_LENGTH = 7;

/**
 * Short code for a law: 7 base-36 characters from a 64-bit FNV-1a hash of its id.
 * It depends only on the id, so a law keeps its short link forever and new laws never move old ones.
 * 36^7 is about 78 billion codes; the build fails if two laws ever share one (see assertUniqueCodes).
 */
export function shortCode(id: string): string {
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(id)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(36).padStart(CODE_LENGTH, "0").slice(-CODE_LENGTH);
}

export const shortPath = (id: string) => `/l/${shortCode(id)}`;
/** The link people share. Visits to /l/* are counted by Vercel Web Analytics. */
export const shortUrl = (id: string, base = SITE_URL) => `${base}${shortPath(id)}`;

/** Map of short code to law id; throws if two ids collide, so a clash can never ship silently. */
export function assertUniqueCodes(ids: string[]): Map<string, string> {
  const byCode = new Map<string, string>();
  for (const id of ids) {
    const code = shortCode(id);
    const other = byCode.get(code);
    if (other && other !== id) throw new Error(`Short code ${code} is shared by ${other} and ${id}`);
    byCode.set(code, id);
  }
  return byCode;
}
