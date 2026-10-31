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
  /** The outlet limits free reading (subscription or monthly article cap). */
  paywall?: boolean;
}

export interface NewsItem {
  title: string;
  url: string;
  outlet: string;
  paywall?: boolean;
  /** ISO timestamp. */
  date: string;
}

export const NEWS_OUTLETS: NewsOutlet[] = [
  { id: "g1", name: "g1", feed: "https://g1.globo.com/rss/g1/politica/" },
  { id: "cnn-brasil", name: "CNN Brasil", feed: "https://www.cnnbrasil.com.br/politica/feed/" },
  { id: "poder360", name: "Poder360", feed: "https://www.poder360.com.br/feed/" },
  { id: "metropoles", name: "Metrópoles", feed: "https://www.metropoles.com/brasil/politica-brasil/feed" },
  { id: "bbc-brasil", name: "BBC News Brasil", feed: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
  { id: "jovem-pan", name: "Jovem Pan", feed: "https://jovempan.com.br/noticias/politica/feed" },
  { id: "folha", name: "Folha de S.Paulo", feed: "https://feeds.folha.uol.com.br/poder/rss091.xml", paywall: true },
  { id: "estadao", name: "Estadão", feed: "https://www.estadao.com.br/arc/outboundfeeds/feeds/rss/sections/politica/", paywall: true },
  { id: "o-globo", name: "O Globo", feed: "https://oglobo.globo.com/rss/politica/", paywall: true },
  { id: "veja", name: "Veja", feed: "https://veja.abril.com.br/politica/feed/", paywall: true },
  { id: "gazeta-do-povo", name: "Gazeta do Povo", feed: "https://www.gazetadopovo.com.br/feed/rss/republica.xml", paywall: true },
  { id: "cartacapital", name: "CartaCapital", feed: "https://www.cartacapital.com.br/politica/feed/" },
  { id: "a-verdade", name: "A Verdade", feed: "https://averdade.org.br/feed/" },
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
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

/** Parses RSS 2.0 items or Atom entries into headlines. Items without a title, an http(s) link or a valid date are skipped. */
export function parseFeed(xml: string, outlet: string, paywall = false): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link = tag(b, "link") || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || tag(b, "guid");
    const raw = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const time = raw ? Date.parse(raw) : NaN;
    if (!title || !link || !/^https?:\/\//.test(link) || Number.isNaN(time)) continue;
    out.push({ title, url: link.replace(/&amp;/g, "&"), outlet, ...(paywall && { paywall }), date: new Date(time).toISOString() });
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
  const results = await Promise.allSettled(outlets.map(async (o) => parseFeed(await get(o.feed), o.name, o.paywall)));
  const failed: string[] = [];
  const items: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.length) items.push(...r.value);
    else failed.push(outlets[i].id);
  });
  return { items, failed };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "LeiAbertaBot/1.0 (+https://lei-aberta.vercel.app)", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}
