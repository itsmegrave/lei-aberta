/**
 * Crawls municipal laws from the capitals' Câmaras Municipais and merges them into the store.
 *
 *   node --experimental-strip-types crawlers/municipal/run.ts [options]
 *
 *   --cities a,b,...     IBGE codes, names or UFs of capitals (default: every câmara with an adapter, see cities.ts)
 *   --since YYYY         first year (default: last year for a câmara that already has data, 1989 for one with none,
 *                        so the first run backfills it)
 *   --until YYYY         last year (default: this year)
 *   --data-dir PATH      default data
 *   --limit N            at most N laws per type and year (SAPL) or N authors (São Paulo), for smoke tests
 *   --mayor-elections Y,Y  TSE elections to read for mayors (default 1996-2024); "none" skips mayors
 *   --dry-run            crawl and print, write nothing
 *   --full               re-fetch laws already stored (by default SAPL câmaras only fetch new laws)
 *   --manifests-only     crawl nothing; only (re)write data/sources/camara-municipal-*.json
 *   --allow-unavailable  a câmara whose server is down (5xx, timeout) is reported, not failed (PR smoke runs)
 *
 * Also sets `executive` (the mayor elected for that term, from TSE) on every capital's municipal record that has
 * none, including records the Diários Oficiais crawler found.
 */
import { parseArgs } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";
import { updateSource } from "../../lib/sources-store.ts";
import type { DataSource } from "../../lib/sources.ts";
import type { Policy } from "../../lib/types.ts";
import { HttpError, RobotsDisallowed } from "../estadual/http.ts";
import { openStore } from "../lib/store.ts";
import { CITIES, type City, findCity, sourceId } from "./cities.ts";
import { crawlCmsp } from "./cmsp.ts";
import type { AdapterResult } from "./common.ts";
import { MUNICIPAL_ELECTIONS, type MayorTable, loadMayors } from "./mayors.ts";
import { crawlSaplCity } from "./sapl.ts";

const { values: args } = parseArgs({
  options: {
    cities: { type: "string" },
    since: { type: "string" },
    until: { type: "string" },
    "data-dir": { type: "string", default: "data" },
    limit: { type: "string" },
    "mayor-elections": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    full: { type: "boolean", default: false },
    "manifests-only": { type: "boolean", default: false },
    "allow-unavailable": { type: "boolean", default: false },
  },
});

const thisYear = new Date().getUTCFullYear();
const until = args.until ? Number(args.until) : thisYear;
const sinceArg = args.since ? Number(args.since) : null;
if ((sinceArg !== null && !(sinceArg >= 1988)) || !(until >= 1988)) throw new Error("--since/--until must be years >= 1988");
const FIRST_YEAR = 1989; // Leis Orgânicas came in 1990; a few câmaras file older laws, which we skip

let cities: City[] = CITIES.filter((c) => c.adapter);
if (args.cities) {
  cities = [];
  for (const key of args.cities.split(",")) {
    const c = findCity(key);
    if (!c) console.warn(`! ${key}: not a capital`);
    else if (!c.adapter) console.warn(`! ${c.name}: no adapter, skipped`);
    else if (!cities.includes(c)) cities.push(c);
  }
}
if (args["manifests-only"]) cities = [];

const dryRun = args["dry-run"];
const dataDir = path.resolve(args["data-dir"]!);
const store = await openStore(dataDir);
const limit = args.limit ? Number(args.limit) : Infinity;
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const prefix = (c: City) => `municipal-${c.ibge}-`;
/** Records this câmara contributed to (the Diários Oficiais crawler can hold the same ids with other sources). */
const fromHouse = (c: City, r: Policy) => r.id.startsWith(prefix(c)) && r.sources.some((s) => s.label.startsWith(c.house));
const hasData = (c: City) => store.all().some((r) => fromHouse(c, r));

const electionsArg = args["mayor-elections"];
const elections = electionsArg === "none" ? [] : electionsArg ? electionsArg.split(",").map(Number) : MUNICIPAL_ELECTIONS;
let mayors: MayorTable | null = null;
if (elections.length && !args["manifests-only"]) {
  const loaded = await loadMayors(CITIES, elections);
  mayors = loaded.table;
  console.log(`Mayors: ${mayors.size} elected mayor(s) of capitals`);
  for (const i of loaded.info) console.log(`  · ${i}`);
}

async function crawl(c: City): Promise<AdapterResult> {
  const years = range(sinceArg ?? (hasData(c) ? thisYear - 1 : FIRST_YEAR), until);
  if (c.adapter === "cmsp") return crawlCmsp(c, years, { limit });
  // Laws already stored are skipped: a law's text and authors don't change once it is enacted.
  const skip = (id: string) => !args.full && !dryRun && (store.get(id) ? fromHouse(c, store.get(id)!) : false);
  return crawlSaplCity(c, years, { limit, skip });
}

interface Outcome {
  city: City;
  result?: AdapterResult;
  fatal?: unknown;
}

// Câmaras are on different hosts, so they run in parallel; the HTTP layer throttles each host.
const outcomes: Outcome[] = await Promise.all(
  cities.map(async (city) => {
    try {
      return { city, result: await crawl(city) };
    } catch (fatal) {
      return { city, fatal };
    }
  }),
);

const isOutage = (e: unknown) =>
  (e instanceof HttpError && e.status >= 500) || (e instanceof Error && /fetch failed|timeout|aborted|ECONNRESET|ENOTFOUND/i.test(`${e.name} ${e.message}`));

const withMayor = (r: Policy): Policy => {
  if (r.executive || !mayors) return r;
  const ibge = r.id.split("-")[1];
  const year = Number(r.signedAt?.slice(0, 4) ?? r.year);
  const executive = mayors.at(ibge, year);
  return executive ? { ...r, executive } : r;
};

let failures = 0;
let unavailable = 0;
for (const o of outcomes) {
  const { city } = o;
  if (o.fatal && args["allow-unavailable"] && isOutage(o.fatal)) {
    unavailable++;
    console.log(`${city.name}: UNAVAILABLE (server down, not counted as a failure) ${o.fatal}`);
    continue;
  }
  if (o.fatal) {
    failures++;
    console.log(`${city.name}: FAILED ${o.fatal}`);
    continue;
  }
  const { records, errors } = o.result!;
  let merged = 0;
  for (const r of records) {
    if (dryRun) continue;
    try {
      // Keep hand-edited titles/summaries and classifier areas; the câmara owns every other field.
      store.upsert(withMayor(r), { owner: true, preserve: ["title", "summary", "areas"] });
      merged++;
    } catch (err) {
      errors.push(String(err));
    }
  }
  if (errors.length && !records.length) {
    failures++;
    o.fatal = errors[0];
  }
  const parties = records.filter((r) => r.parties.length).length;
  console.log(`${city.name}: ${records.length} law(s) found (${parties} with an author's party), ${merged} merged, ${errors.length} error(s)`);
  for (const i of o.result!.info ?? []) console.log(`  · ${i}`);
  for (const e of errors.slice(0, 20)) console.log(`  ! ${e}`);
  if (dryRun)
    for (const r of records.slice(0, 6).map(withMayor))
      console.log(`  ${r.id}: ${r.title} [${r.authors.map((a) => `${a.name} <${a.kind}${a.party ? `, ${a.party}` : ""}>`).join(", ")}]${r.executive ? ` mayor: ${r.executive.name} (${r.executive.party})` : ""}`);
}

// Mayors for municipal records that have none yet (earlier runs, or found in the Diários Oficiais).
let mayorsSet = 0;
if (mayors && !dryRun) {
  const capitals = new Set(CITIES.map((c) => c.ibge));
  for (const r of store.all()) {
    if (r.level !== "municipal" || r.executive || !capitals.has(r.id.split("-")[1])) continue;
    const next = withMayor(r);
    if (next === r) continue;
    store.upsert(next, { owner: true });
    mayorsSet++;
  }
  console.log(`Mayor set on ${mayorsSet} earlier record(s).`);
}

if (!dryRun) {
  if (store.changed()) console.log(`Saved ${await store.save()} change(s).`);
  await writeManifests();
}

if (cities.length && failures && failures + unavailable === cities.length) {
  console.error("Every câmara crawl failed.");
  process.exit(1);
}

/** One data/sources file per capital's câmara, plus the TSE manifest (mayors). */
async function writeManifests() {
  const sourcesDir = path.join(dataDir, "sources");
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const all = store.all().filter((r) => r.level === "municipal");
  for (const c of CITIES) {
    const mine = all.filter((r) => fromHouse(c, r));
    const base: Partial<DataSource> = {
      id: sourceId(c),
      name: c.house,
      publisher: c.house,
      url: c.url,
      levels: ["municipal"],
      coverage: [`${c.name} (${c.uf})`],
      covers: ["lei municipal", "lei complementar municipal"],
      description: c.adapter
        ? c.note ?? `Leis de ${c.name}, com autores e o partido de cada vereador na época.`
        : c.note ?? "Ainda sem coleta automática.",
      crawler: c.adapter ? "crawlers/municipal/run.ts" : null,
      records: mine.length || null,
      since: mine.length ? Math.min(...mine.map((r) => r.year)) : null,
    };
    const o = outcomes.find((x) => x.city === c);
    let patch: Partial<DataSource>;
    if (!c.adapter) patch = { ...base, status: "planned" };
    else if (!o) patch = base;
    else if (o.fatal instanceof RobotsDisallowed) patch = { ...base, status: "planned", lastRun: now };
    else if (o.fatal && !(args["allow-unavailable"] && isOutage(o.fatal))) patch = { ...base, status: "failing", lastRun: now };
    else if (o.fatal) patch = { ...base, lastRun: now };
    else patch = { ...base, status: "active", lastRun: now, lastSuccess: now };
    if (!patch.status && !(await exists(path.join(sourcesDir, `${sourceId(c)}.json`)))) patch.status = "building";
    await updateSource(sourceId(c), patch, sourcesDir);
  }
  if (mayors?.size) {
    const records = all.filter((r) => r.executive?.basis === "election").length;
    await updateSource(
      "tse",
      {
        status: "active",
        coverage: ["Prefeitos das capitais"],
        description: "Partido de presidentes, governadores e prefeitos na época de cada lei. Por enquanto, os prefeitos das capitais (partido da eleição).",
        crawler: "crawlers/municipal/run.ts",
        since: 1997,
        records: records || null,
        lastRun: now,
        lastSuccess: now,
      },
      sourcesDir,
    );
  }
}

function exists(file: string) {
  return access(file).then(
    () => true,
    () => false,
  );
}
