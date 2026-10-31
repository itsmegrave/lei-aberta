// Reads every news feed on the home and prints how many headlines each gives.
// Exits 1 if any feed fails, so a broken or moved feed shows up in CI.
import { fetchNews, NEWS_OUTLETS } from "../lib/news.ts";

let bad = 0;
for (const o of NEWS_OUTLETS) {
  const { items, failed } = await fetchNews([o]).catch(() => ({ items: [], failed: [o.id] }));
  const newest = items.map((i) => i.date).sort().at(-1) ?? "-";
  console.log(`${failed.length ? "FAIL" : "ok  "} ${o.name.padEnd(16)} ${String(items.length).padStart(3)} headlines, newest ${newest}  ${o.feed}`);
  if (failed.length) bad++;
}
process.exit(bad ? 1 : 0);
