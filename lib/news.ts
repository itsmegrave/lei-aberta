/**
 * Political news for the home page: headlines from the public RSS feeds of free-to-read outlets.
 * Only the headline, outlet, date and link are kept; the article text is never stored or shown.
 *
 * The outlet list was chosen by the project owner: outlets across the political spectrum plus the
 * public news agencies. Paywalled outlets stay in, flagged with `paywall` so the site can warn readers;
 * we always link the original story and never route around a paywall. Change the list only with their say.
 */
export interface NewsOutlet {
  id: string;
  name: string;
  /** Public RSS (or Atom) feed of the outlet's politics section. */
  feed: string;
  /** Other feed addresses to try, in order, when `feed` fails. */
  fallbacks?: string[];
  /** The outlet limits free reading (subscription or monthly article cap). */
  paywall?: boolean;
}

export interface NewsItem {
  title: string;
  url: string;
  outlet: string;
  paywall?: boolean;
  /** The outlet's own short description of the story, as its feed gives it for previews; capped. */
  summary?: string;
  /** Preview image the outlet's feed points to (https), shown from the outlet's own server. */
  image?: string;
  /** ISO timestamp. */
  date: string;
}

export const NEWS_OUTLETS: NewsOutlet[] = [
  { id: "g1", name: "g1", feed: "https://g1.globo.com/rss/g1/politica/" },
  { id: "cnn-brasil", name: "CNN Brasil", feed: "https://www.cnnbrasil.com.br/politica/feed/", fallbacks: ["https://www.cnnbrasil.com.br/politica/feed", "https://www.cnnbrasil.com.br/feed/"] },
  { id: "poder360", name: "Poder360", feed: "https://www.poder360.com.br/feed/" },
  { id: "metropoles", name: "Metrópoles", feed: "https://www.metropoles.com/brasil/politica-brasil/feed" },
  { id: "bbc-brasil", name: "BBC News Brasil", feed: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
  { id: "jovem-pan", name: "Jovem Pan", feed: "https://jovempan.com.br/noticias/politica/feed", fallbacks: ["https://jovempan.com.br/noticias/politica/feed/", "https://jovempan.com.br/feed"] },
  { id: "folha", name: "Folha de S.Paulo", feed: "https://feeds.folha.uol.com.br/poder/rss091.xml", paywall: true },
  { id: "estadao", name: "Estadão", feed: "https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/", paywall: true },
  { id: "o-globo", name: "O Globo", feed: "https://oglobo.globo.com/rss/politica/", fallbacks: ["https://oglobo.globo.com/rss/oglobo", "https://oglobo.globo.com/rss.xml"], paywall: true },
  { id: "veja", name: "Veja", feed: "https://veja.abril.com.br/politica/feed/", paywall: true },
  { id: "gazeta-do-povo", name: "Gazeta do Povo", feed: "https://www.gazetadopovo.com.br/feed/rss/republica.xml", paywall: true },
  { id: "cartacapital", name: "CartaCapital", feed: "https://www.cartacapital.com.br/politica/feed/" },
  { id: "a-verdade", name: "A Verdade", feed: "https://averdade.org.br/feed/", fallbacks: ["https://averdade.org.br/feed", "https://averdade.org.br/category/politica/feed/"] },
  { id: "agencia-brasil", name: "Agência Brasil", feed: "https://agenciabrasil.ebc.com.br/rss/politica/feed.xml" },
  { id: "agencia-camara", name: "Agência Câmara", feed: "https://www.camara.leg.br/noticias/rss/ultimas-noticias" },
  { id: "agencia-senado", name: "Agência Senado", feed: "https://www12.senado.leg.br/noticias/rss" },
];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    // Some feeds entity-encode their HTML, so tags show up only after decoding.
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

function rawTag(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
}

const SUMMARY_MAX = 200;

/** Cuts at a word boundary so the summary stays a short preview, like a link card. */
export function clip(text: string, max = SUMMARY_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** The preview image the item points to: media:content / media:thumbnail / an image enclosure / the first <img>. */
function imageOf(block: string): string | undefined {
  const attrs = (re: RegExp) => [...block.matchAll(re)].map((m) => m[0]);
  const url = (t: string) => t.match(/\burl="([^"]+)"/i)?.[1];
  const media = attrs(/<media:(?:content|thumbnail)\b[^>]*>/gi).find((t) => !/medium="(?!image)/i.test(t) && !/type="(?!image)/i.test(t));
  const enclosure = attrs(/<enclosure\b[^>]*>/gi).find((t) => /type="image\//i.test(t));
  const html = (rawTag(block, "description") + rawTag(block, "content:encoded")).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const found = (media && url(media)) || (enclosure && url(enclosure)) || img;
  const clean = found?.replace(/&amp;/g, "&");
  return clean && /^https:\/\//.test(clean) ? clean : undefined;
}

/** A feed address that is already a politics section (or a legislature's own news), so its items need no topic filter. */
export const POLITICS_FEED = /politic|\/poder\/|republica|\.leg\.br\//i;

const POLITICS_SECTION = /\/(politica|poder|republica|eleicoes|eleicao)(\/|-|$)/i;
const POLITICS_CATEGORY = /pol[ií]tica|elei[cç]|congresso|senado|c[aâ]mara|\bstf\b|supremo|planalto|governo federal|partido/i;
// Whole words or phrases that mark a story as political news when the feed gives no section or category.
const POLITICS_WORDS =
  /\b(lula|bolsonaro|congresso|senado|senador(a|es)?|c[aâ]mara dos deputados|deputad[oa]s?|stf|supremo tribunal|tse|ministr[oa]s?|minist[eé]rio|planalto|governador(a|es)?|prefeit[oa]s?|elei[cç](ão|ões)|eleitora(l|is)|pec|projeto de lei|medida provis[oó]ria|partido|oposi[cç][aã]o|base aliada|impeachment|cpi|reforma (tribut[aá]ria|administrativa|pol[ií]tica)|or[cç]amento|alcolumbre|hugo motta)\b/i;

/** Whether an item from a general (all-topics) feed is political news: by URL section, feed category, or headline words. */
export function isPolitics(item: Pick<NewsItem, "url" | "title" | "summary">, categories: string[] = []): boolean {
  let path = "";
  try {
    path = new URL(item.url).pathname;
  } catch {}
  if (POLITICS_SECTION.test(path)) return true;
  if (categories.some((c) => POLITICS_CATEGORY.test(c))) return true;
  return POLITICS_WORDS.test(`${item.title} ${item.summary ?? ""}`);
}

/** Adds utm_source=lei-aberta so outlets can see the visit came from Lei Aberta. */
export function withUtm(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "lei-aberta");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Parses RSS 2.0 items or Atom entries into headlines. Items without a title, an http(s) link or a valid date are skipped.
 * With `politicsOnly`, items that are not political news (see isPolitics) are dropped too.
 */
export function parseFeed(xml: string, outlet: string, paywall = false, politicsOnly = false): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link = tag(b, "link") || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || tag(b, "guid");
    const raw = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const time = raw ? Date.parse(raw) : NaN;
    if (!title || !link || !/^https?:\/\//.test(link) || Number.isNaN(time)) continue;
    const summary = clip(tag(b, "description") ?? tag(b, "summary") ?? "");
    const image = imageOf(b);
    const url = link.replace(/&amp;/g, "&");
    if (politicsOnly) {
      const categories = [...b.matchAll(/<category\b[^>]*?(?:term="([^"]*)")?[^>]*?(?:\/>|>([\s\S]*?)<\/category>)/gi)].map((m) => decode(m[1] ?? m[2] ?? ""));
      if (!isPolitics({ url, title, summary }, categories)) continue;
    }
    out.push({
      title,
      url,
      outlet,
      ...(paywall && { paywall }),
      ...(summary && summary !== title && { summary }),
      ...(image && { image }),
      date: new Date(time).toISOString(),
    });
  }
  return out;
}

/**
 * Newest first, at most `perOutlet` from any one outlet so no site fills the list,
 * no duplicate links, nothing dated in the future (beyond clock skew).
 */
export function mixNews(items: NewsItem[], { limit = 12, perOutlet = 2, now = Date.now() } = {}): NewsItem[] {
  const seen = new Set<string>();
  const count = new Map<string, number>();
  const out: NewsItem[] = [];
  for (const it of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
    if (Date.parse(it.date) > now + 60 * 60 * 1000 || seen.has(it.url)) continue;
    const n = count.get(it.outlet) ?? 0;
    if (n >= perOutlet) continue;
    seen.add(it.url);
    count.set(it.outlet, n + 1);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

/** Fetches every feed in parallel; a feed that fails or times out is skipped, never the whole list. */
export async function fetchNews(
  outlets: NewsOutlet[] = NEWS_OUTLETS,
  get: (url: string) => Promise<string> = fetchText,
): Promise<{ items: NewsItem[]; failed: string[] }> {
  const results = await Promise.allSettled(outlets.map((o) => readOutlet(o, get).then((r) => r.items)));
  const failed: string[] = [];
  const items: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.length) items.push(...r.value);
    else failed.push(outlets[i].id);
  });
  return { items, failed };
}

/** Tries the outlet's feed, then its fallbacks, and returns the first one that gives headlines. */
export async function readOutlet(o: NewsOutlet, get: (url: string) => Promise<string> = fetchText): Promise<{ items: NewsItem[]; feed: string; errors: string[] }> {
  const errors: string[] = [];
  for (const feed of [o.feed, ...(o.fallbacks ?? [])]) {
    try {
      // General feeds (a fallback, or an outlet without a politics feed) carry every topic: keep only politics.
      const items = parseFeed(await get(feed), o.name, o.paywall, !POLITICS_FEED.test(feed));
      if (items.length) return { items, feed, errors };
      errors.push(`${feed}: no items`);
    } catch (e) {
      errors.push(`${feed}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "LeiAbertaBot/1.0 (+https://lei-aberta.vercel.app)", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
