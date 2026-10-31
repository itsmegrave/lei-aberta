// Reads every news feed on the home and prints how many headlines each gives, and why a feed failed.
// Exits 1 if any outlet fails, so a broken or moved feed shows up in CI.
import { NEWS_OUTLETS, readOutlet } from "../lib/news.ts";

let bad = 0;
for (const o of NEWS_OUTLETS) {
  try {
    const { items, feed } = await readOutlet(o);
    const newest = items.map((i) => i.date).sort().at(-1);
    const withSummary = items.filter((i) => i.summary).length;
    const withImage = items.filter((i) => i.image).length;
    console.log(`ok   ${o.name.padEnd(16)} ${String(items.length).padStart(3)} headlines (${withSummary} summaries, ${withImage} images), newest ${newest}  ${feed}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${o.name.padEnd(16)} ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(bad ? 1 : 0);
