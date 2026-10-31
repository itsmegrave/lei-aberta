/**
 * Crawls state laws from the legislative assemblies and merges them into data/estadual/<year>.json.
 *
 *   node --experimental-strip-types crawlers/estadual/run.ts [options]
 *
 *   --states SP,PB,...   UFs to crawl (default: every house with an adapter, see states.ts)
 *   --since YYYY         first year (default: last year for SAPL houses that already have data, 1989 for a house with
 *                        no data yet so the first run backfills it, and 1989 for Alesp, whose dump is read whole anyway)
 *   --until YYYY         last year (default: this year)
 *   --data-dir PATH      default data
 *   --limit N            at most N laws per type and year in SAPL houses (smoke tests)
 *   --dry-run            crawl and print, write nothing
 *   --manifests-only     crawl nothing; only (re)write data/sources/assembleia-*.json
 *
 * Also rewrites data/sources/assembleia-<uf>.json for all 27 houses (status, counts, last run).
 */
import { parseArgs } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";
import { updateSource } from "../../lib/sources-store.ts";
import type { DataSource } from "../../lib/sources.ts";
import { openStore } from "../lib/store.ts";
import { crawlAlesp } from "./alesp.ts";
import type { AdapterResult } from "./common.ts";
import { HttpError, RobotsDisallowed } from "./http.ts";
import { crawlSapl } from "./sapl.ts";
import { STATES, type StateHouse, sourceId } from "./states.ts";

const { values: args } = parseArgs({
  options: {
    states: { type: "string" },
    since: { type: "string" },
    until: { type: "string" },
    "data-dir": { type: "string", default: "data" },
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "manifests-only": { type: "boolean", default: false },
    // Smoke runs on PRs: a house whose server is down (5xx, timeout, network error) is reported, not failed,
    // so an outage at an assembly can't block an unrelated PR. Parse and format errors still fail.
    "allow-unavailable": { type: "boolean", default: false },
  },
});

const thisYear = new Date().getUTCFullYear();
const until = args.until ? Number(args.until) : thisYear;
const sinceArg = args.since ? Number(args.since) : null;
if ((sinceArg !== null && !(sinceArg >= 1988)) || !(until >= 1988)) throw new Error("--since/--until must be years >= 1988");

const wanted = args.states ? new Set(args.states.toUpperCase().split(",").map((s) => s.trim())) : null;
const houses = args["manifests-only"] ? [] : STATES.filter((h) => h.adapter && (!wanted || wanted.has(h.uf)));
if (wanted) for (const uf of wanted) if (!STATES.some((h) => h.uf === uf && h.adapter)) console.warn(`! ${uf}: no adapter, skipped`);

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

const dataDir = path.resolve(args["data-dir"]!);
const store = await openStore(dataDir);
const FIRST_YEAR = 1989; // state constitutions were enacted in 1989

const hasData = (uf: string) => store.all().some((r) => r.id.startsWith(`estadual-${uf.toLowerCase()}-`));

async function crawl(h: StateHouse): Promise<AdapterResult> {
  if (h.adapter === "alesp") return crawlAlesp(h, { since: sinceArg ?? FIRST_YEAR, until });
  const limit = args.limit ? Number(args.limit) : Infinity;
  return crawlSapl(h, range(sinceArg ?? (hasData(h.uf) ? thisYear - 1 : FIRST_YEAR), until), { limit });
}

interface Outcome {
  house: StateHouse;
  result?: AdapterResult;
  fatal?: unknown;
}

// Houses are on different hosts, so they run in parallel; each adapter throttles its own host.
const outcomes: Outcome[] = await Promise.all(
  houses.map(async (house) => {
    try {
      return { house, result: await crawl(house) };
    } catch (fatal) {
      return { house, fatal };
    }
  }),
);

const dryRun = args["dry-run"];
const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
let failures = 0;
let unavailable = 0;
let mergedTotal = 0;

/** True for errors that mean the house's server is down, not that our code is wrong. */
const isOutage = (e: unknown) =>
  (e instanceof HttpError && e.status >= 500) || (e instanceof Error && /fetch failed|timeout|aborted|ECONNRESET|ENOTFOUND/i.test(`${e.name} ${e.message}`));

for (const o of outcomes) {
  const { house } = o;
  if (o.fatal && args["allow-unavailable"] && isOutage(o.fatal)) {
    unavailable++;
    console.log(`${house.uf}: UNAVAILABLE (server down, not counted as a failure) ${o.fatal}`);
    continue;
  }
  if (o.fatal) {
    failures++;
    console.log(`${house.uf}: FAILED ${o.fatal}`);
    continue;
  }
  const { records, errors } = o.result!;
  let merged = 0;
  for (const r of records) {
    if (dryRun) continue;
    try {
      // Keep hand-edited titles/summaries and classifier areas; the house owns every other field.
      store.upsert(r, { owner: true, preserve: ["title", "summary", "areas"] });
      merged++;
      mergedTotal++;
    } catch (err) {
      errors.push(String(err));
    }
  }
  if (errors.length && !records.length) {
    failures++;
    o.fatal = errors[0];
  }
  console.log(`${house.uf}: ${records.length} law(s) found, ${merged} merged, ${errors.length} error(s)`);
  for (const i of o.result!.info ?? []) console.log(`  · ${i}`);
  for (const e of errors.slice(0, 20)) console.log(`  ! ${e}`);
  if (args["dry-run"]) for (const r of records.slice(0, 6)) console.log(`  ${r.id}: ${r.title} [${r.authors.map((a) => `${a.name} <${a.kind}${a.party ? `, ${a.party}` : ""}>`).join(", ")}]`);
}

if (!dryRun) {
  // Saving with nothing merged would still rewrite index.json, so skip it.
  if (mergedTotal) await store.save();
  await writeManifests();
}

if (houses.length && failures && failures + unavailable === houses.length) {
  console.error("Every state crawl failed.");
  process.exit(1);
}

/** One data/sources file per house. Only houses crawled in this run get a new lastRun/status. */
async function writeManifests() {
  const sourcesDir = path.join(dataDir, "sources");
  const all = store.all().filter((r) => r.level === "estadual");
  for (const h of STATES) {
    const mine = all.filter((r) => r.id.startsWith(`estadual-${h.uf.toLowerCase()}-`));
    const base: Partial<DataSource> = {
      id: sourceId(h.uf),
      name: h.house,
      publisher: h.house,
      url: h.url,
      levels: ["estadual"],
      coverage: [h.uf],
      covers: ["lei", "lei complementar", "emenda constitucional"],
      description: h.adapter
        ? h.note ?? "Leis, leis complementares e emendas à Constituição do estado, com autores e o partido de cada um na época."
        : h.note ?? "Ainda sem coleta automática.",
      crawler: h.adapter ? "crawlers/estadual/run.ts" : null,
      records: mine.length || null,
      since: mine.length ? Math.min(...mine.map((r) => r.year)) : null,
    };
    const o = outcomes.find((x) => x.house.uf === h.uf);
    let patch: Partial<DataSource>;
    if (!h.adapter) patch = { ...base, status: "planned" };
    else if (!o) patch = base; // not crawled this run: keep status and timestamps
    else if (o.fatal instanceof RobotsDisallowed) patch = { ...base, status: "planned", lastRun: now };
    else if (o.fatal) patch = { ...base, status: "failing", lastRun: now };
    else patch = { ...base, status: "active", lastRun: now, lastSuccess: now };
    // A crawlable house seen for the first time starts as "building" until its first good run.
    if (!patch.status && !(await exists(path.join(sourcesDir, `${sourceId(h.uf)}.json`)))) patch.status = "building";
    await updateSource(sourceId(h.uf), patch, sourcesDir);
  }
}

function exists(file: string) {
  return access(file).then(
    () => true,
    () => false,
  );
}
