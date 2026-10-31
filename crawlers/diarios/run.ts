/**
 * Crawls Diários Oficiais and merges the results into data/.
 *
 *   node --experimental-strip-types crawlers/diarios/run.ts [options]
 *
 *   --source dou|qd|all    which diários to read (default all)
 *   --since YYYY-MM-DD     first publication day (default: 3 days ago for DOU, 7 for Querido Diário)
 *   --until YYYY-MM-DD     last publication day (default today, UTC)
 *   --territories capitals|all|<ibge,ibge,...>   Querido Diário cities (default capitals)
 *   --max-gazettes N       cap on gazette texts read per run (default 400)
 *   --data-dir PATH        default data
 *   --dry-run              crawl and print, write nothing
 */
import { parseArgs } from "node:util";
import path from "node:path";
import type { Policy } from "../../lib/types.ts";
import { openStore } from "../lib/store.ts";
import { crawlDou } from "./dou.ts";
import { CAPITALS, crawlQueridoDiario } from "./querido-diario.ts";
import { dateRange, daysAgo } from "./text.ts";

const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: "all" },
    since: { type: "string" },
    until: { type: "string" },
    territories: { type: "string", default: "capitals" },
    "max-gazettes": { type: "string", default: "400" },
    "data-dir": { type: "string", default: "data" },
    "dry-run": { type: "boolean", default: false },
  },
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;
for (const k of ["since", "until"] as const) {
  if (args[k] && !DAY.test(args[k]!)) throw new Error(`--${k} must be YYYY-MM-DD`);
}
const until = args.until ?? daysAgo(0);
const territories =
  args.territories === "capitals" ? Object.keys(CAPITALS) : args.territories === "all" ? [] : args.territories!.split(",").map((s) => s.trim());

interface SourceRun {
  name: string;
  records: Policy[];
  errors: string[];
  /** DOU only adds to records the federal crawler owns; municipal records are ours. */
  owner: boolean;
}

const runs: SourceRun[] = [];
if (args.source === "dou" || args.source === "all") {
  const since = args.since ?? daysAgo(3);
  runs.push({ name: "DOU", owner: false, ...(await crawlDou(dateRange(since, until))) });
}
if (args.source === "qd" || args.source === "all") {
  // Querido Diário indexes gazettes a few days after publication, so it looks further back.
  const since = args.since ?? daysAgo(7);
  const res = await crawlQueridoDiario({ territories, since, until, maxGazettes: Number(args["max-gazettes"]) });
  runs.push({ name: "Querido Diário", owner: true, ...res });
}

const store = args["dry-run"] ? null : await openStore(path.resolve(args["data-dir"]!));
let failed = false;
for (const run of runs) {
  let upserted = 0;
  for (const r of run.records) {
    if (!store) continue;
    try {
      // Keep titles and summaries someone may have edited by hand, and areas set by the classifier.
      store.upsert(r, { owner: run.owner, preserve: ["title", "summary", "areas"] });
      upserted++;
    } catch (err) {
      run.errors.push(String(err));
    }
  }
  console.log(`${run.name}: ${run.records.length} record(s) found, ${upserted} merged, ${run.errors.length} error(s)`);
  for (const e of run.errors.slice(0, 30)) console.log(`  ! ${e}`);
  if (args["dry-run"]) for (const r of run.records.slice(0, 5)) console.log(`  ${r.id}: ${r.title}`);
  // A run with errors and nothing found means the source is unreachable or its format changed.
  if (run.errors.length && !run.records.length) failed = true;
}

if (store) console.log(`Wrote ${await store.save()} data file(s).`);
if (failed) process.exitCode = 1;
