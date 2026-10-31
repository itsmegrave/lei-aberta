/**
 * Creates Dub (dub.co) short links for laws that do not have one yet and saves them to
 * data/short-links.json ({ "<law id>": "https://dub.sh/abc123" }). The site reads that file at
 * build time; laws without a short link are shared with their full page URL.
 *
 * Runs in GitHub Actions (.github/workflows/short-links.yml) because the API key must stay secret.
 *
 * Env:
 *   DUB_API_KEY         required; without it the script does nothing and exits 0.
 *   DUB_DOMAIN          optional custom short domain registered in Dub (default: Dub's own dub.sh).
 *   DUB_MAX_NEW_LINKS   most links to create per run (default 20). Dub's free plan allows 25 new links a month.
 *   NEXT_PUBLIC_SITE_URL  site address the links point to (default https://lei-aberta.vercel.app).
 *
 * Usage: node --experimental-strip-types scripts/short-links.ts [--dry-run]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lawUrl, SITE_URL, type ShortLinks } from "../lib/share.ts";

const DATA = path.join(import.meta.dirname, "..", "data");
const FILE = path.join(DATA, "short-links.json");
const API = "https://api.dub.co";

interface Law { id: string; year: number; signedAt?: string | null }

/** Laws still missing a short link, newest first (the ones most likely to be shared), capped at `max`. */
export function pickMissing(laws: Law[], links: ShortLinks, max: number): Law[] {
  return laws
    .filter((l) => !links[l.id])
    .sort((a, b) => b.year - a.year || (b.signedAt ?? "").localeCompare(a.signedAt ?? "") || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, max));
}

/** Request body for Dub's upsert: same target URL returns the existing link instead of a new one. */
export function linkBody(id: string, base: string, domain?: string) {
  return {
    url: lawUrl(id, base),
    externalId: id,
    tagNames: ["lei-aberta"],
    ...(domain ? { domain } : {}),
  };
}

async function loadLaws(): Promise<Law[]> {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8")) as { files: { path: string }[] };
  const files = await Promise.all(index.files.map(async (f) => JSON.parse(await readFile(path.join(DATA, f.path), "utf8")) as Law[]));
  return files.flat();
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const key = process.env.DUB_API_KEY;
  if (!key && !dry) {
    console.log("DUB_API_KEY is not set: skipping short links.");
    return;
  }
  const max = Number(process.env.DUB_MAX_NEW_LINKS ?? 20);
  const domain = process.env.DUB_DOMAIN || undefined;
  const links: ShortLinks = JSON.parse(await readFile(FILE, "utf8").catch(() => "{}"));
  const laws = await loadLaws();
  const todo = pickMissing(laws, links, max);
  console.log(`${laws.length} laws, ${Object.keys(links).length} with short links, creating ${todo.length} (max ${max}).`);

  let created = 0;
  for (const law of todo) {
    const body = linkBody(law.id, SITE_URL, domain);
    if (dry) {
      console.log("would create", body.url);
      continue;
    }
    const res = await fetch(`${API}/links/upsert`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { shortLink?: string; error?: { code?: string; message?: string } };
    if (!res.ok || !json.shortLink) {
      console.error(`Dub ${res.status} for ${law.id}: ${json.error?.code ?? ""} ${json.error?.message ?? ""}`);
      // Out of quota or bad key: stop, keep what we have.
      if ([401, 403, 429].includes(res.status) || json.error?.code === "exceeded_limit") break;
      continue;
    }
    links[law.id] = json.shortLink;
    created++;
  }

  if (!dry) {
    // Sorted keys keep diffs small and stable.
    const sorted = Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(FILE, JSON.stringify(sorted, null, 2) + "\n");
  }
  console.log(`Created ${created} short links.`);
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) await main();
