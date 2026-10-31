import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchNews, mixNews, NEWS_OUTLETS, parseFeed, type NewsItem } from "./news.ts";

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>X</title>
<item><title><![CDATA[Senado aprova PEC &amp; segue]]></title><link>https://a.com.br/1?x=1&amp;y=2</link><pubDate>Thu, 29 Oct 2026 20:59:00 GMT</pubDate><description><![CDATA[<p>texto longo</p>]]></description></item>
<item><title>Sem data</title><link>https://a.com.br/2</link></item>
<item><title>Link ruim</title><link>javascript:alert(1)</link><pubDate>Thu, 29 Oct 2026 20:59:00 GMT</pubDate></item>
<item><title>C&#226;mara &#x2014; vota&#231;&#227;o</title><guid>https://a.com.br/3</guid><pubDate>Fri, 30 Oct 2026 10:00:00 -0300</pubDate></item>
</channel></rss>`;

test("parseFeed reads RSS items, decodes text and skips bad ones", () => {
  const items = parseFeed(rss, "A");
  assert.deepEqual(items, [
    { title: "Senado aprova PEC & segue", url: "https://a.com.br/1?x=1&y=2", outlet: "A", date: "2026-10-29T20:59:00.000Z" },
    { title: "Câmara — votação", url: "https://a.com.br/3", outlet: "A", date: "2026-10-30T13:00:00.000Z" },
  ]);
});

test("parseFeed flags paywalled outlets", () => {
  assert.ok(parseFeed(rss, "A", true).every((i) => i.paywall === true));
  assert.ok(parseFeed(rss, "A").every((i) => !("paywall" in i)));
});

test("parseFeed reads Atom entries", () => {
  const atom = `<feed><entry><title type="html">Notícia</title><link rel="alternate" href="https://b.com/n"/><updated>2026-10-31T12:00:00Z</updated></entry></feed>`;
  assert.deepEqual(parseFeed(atom, "B"), [{ title: "Notícia", url: "https://b.com/n", outlet: "B", date: "2026-10-31T12:00:00.000Z" }]);
});

const item = (outlet: string, h: number, url = `https://${outlet}.com/${h}`): NewsItem => ({ title: `${outlet} ${h}`, url, outlet, date: new Date(Date.UTC(2026, 9, 31, h)).toISOString() });

test("mixNews sorts newest first and caps each outlet", () => {
  const now = Date.UTC(2026, 9, 31, 23);
  const all = [item("a", 10), item("a", 11), item("a", 12), item("b", 9), item("c", 8)];
  assert.deepEqual(mixNews(all, { now, perOutlet: 2 }).map((n) => n.title), ["a 12", "a 11", "b 9", "c 8"]);
  assert.equal(mixNews(all, { now, limit: 2 }).length, 2);
});

test("mixNews drops duplicate links and future dates", () => {
  const now = Date.UTC(2026, 9, 31, 12);
  const all = [item("a", 10, "https://x/1"), item("b", 9, "https://x/1"), item("c", 20)];
  assert.deepEqual(mixNews(all, { now }).map((n) => n.title), ["a 10"]);
});

test("fetchNews keeps working feeds when others fail", async () => {
  const outlets = [
    { id: "ok", name: "OK", feed: "https://ok/feed" },
    { id: "down", name: "Down", feed: "https://down/feed" },
    { id: "empty", name: "Empty", feed: "https://empty/feed" },
  ];
  const get = async (url: string) => {
    if (url.includes("down")) throw new Error("boom");
    return url.includes("ok") ? rss : "<rss></rss>";
  };
  const { items, failed } = await fetchNews(outlets, get);
  assert.equal(items.length, 2);
  assert.deepEqual(failed, ["down", "empty"]);
});

test("every outlet uses an https feed and a unique id", () => {
  assert.equal(new Set(NEWS_OUTLETS.map((o) => o.id)).size, NEWS_OUTLETS.length);
  for (const o of NEWS_OUTLETS) assert.match(o.feed, /^https:\/\//);
});
