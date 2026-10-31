// Federal crawler: laws (ordinárias and complementares) and medidas provisórias since 1988.
//
//   npm run crawl:federal -- --from 2023 --to 2026          # specific years
//   npm run crawl:federal -- --from 1988                     # full backfill
//   npm run crawl:federal -- --from 2020 --to 2020 --limit 5 --dry-run   # smoke test
//
// Default (no --from): the current and previous year, which is what the nightly job runs.
import path from "node:path";
import { updateSource } from "../../lib/sources-store.ts";
import type { Policy } from "../../lib/types.ts";
import { makeFetchJson } from "../lib/http.ts";
import { openStore } from "../lib/store.ts";
import { makeApis, type Apis, type NormType, type SenadoNorm, type SenadoProcessSummary } from "./apis.ts";
import { brDateToIso } from "./text.ts";
import { EC32, lawRecord, mpRecord, parseIdent, parseNormaGerada, pickProcess, resolveAuthorship } from "./build.ts";

interface Options {
  from: number;
  to: number;
  types: NormType[];
  limit: number;
  /** Only these norm numbers (smoke tests). */
  only: string[] | null;
  dryRun: boolean;
  dataDir: string;
}

function parseArgs(argv: string[]): Options {
  const get = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const now = new Date().getUTCFullYear();
  const from = Number(get("from") ?? now - 1);
  return {
    from,
    to: Number(get("to") ?? now),
    types: (get("types") ?? "LEI,LCP,MPV").split(",").map((t) => t.trim().toUpperCase()) as NormType[],
    limit: Number(get("limit") ?? Infinity),
    only: get("only")?.split(",").map((n) => n.replace(/\D/g, "")) ?? null,
    dryRun: argv.includes("--dry-run"),
    dataDir: path.resolve(get("data") ?? "data"),
  };
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Runs `fn` over items, collecting failures instead of stopping at the first one. */
async function each<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<{ ok: R[]; failed: { item: T; error: unknown }[] }> {
  const settled = await Promise.allSettled(items.map(fn));
  const ok: R[] = [];
  const failed: { item: T; error: unknown }[] = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? ok.push(s.value) : failed.push({ item: items[i], error: s.reason })));
  return { ok, failed };
}

async function crawlLaws(apis: Apis, type: "LEI" | "LCP", year: number, limit: number, only: string[] | null): Promise<{ records: Policy[]; failed: number }> {
  const [norms, procs] = await Promise.all([apis.listNorms(type, year), apis.processesByNorm(type, year).catch(() => [] as SenadoProcessSummary[])]);
  const byNorm = new Map<string, SenadoProcessSummary[]>();
  for (const p of procs) {
    const n = parseNormaGerada(p.normaGerada);
    if (!n) continue;
    const k = `${n.numero}|${n.date}`;
    byNorm.set(k, [...(byNorm.get(k) ?? []), p]);
  }
  const picked = norms.filter((n) => !only || only.includes(n.numero)).slice(0, limit);
  const { ok, failed } = await each(picked, async (n) => {
    const proc = pickProcess(byNorm.get(`${n.numero}|${brDateToIso(n.dataassinatura)}`) ?? []);
    const auth = proc ? await resolveAuthorship(apis, proc) : null;
    return lawRecord(type, n, auth);
  });
  for (const f of failed) console.warn(`  ! ${type} ${(f.item as SenadoNorm).norma}: ${(f.error as Error).message}`);
  return { records: ok, failed: failed.length };
}

async function crawlMps(apis: Apis, years: number[], limit: number, only: string[] | null): Promise<{ records: Policy[]; failed: number }> {
  // Reissues of a pre-EC 32 MP span several years, so the whole 1988-2001 era is read together.
  const preEra = years.some((y) => y <= 2001);
  const allYears = [...new Set([...(preEra ? range(1988, 2001) : []), ...years])].sort();
  const lists = await Promise.all(allYears.map(async (y) => ({ y, norms: await apis.listNorms("MPV", y), procs: await apis.mpProcesses(y).catch(() => []) })));

  const groups = new Map<string, SenadoNorm[]>();
  for (const { norms } of lists)
    for (const n of norms) {
      const era = brDateToIso(n.dataassinatura)! < EC32 ? "pre" : "post";
      const k = `${era}|${n.numero}`;
      groups.set(k, [...(groups.get(k) ?? []), n]);
    }
  const procs = new Map<string, SenadoProcessSummary>();
  for (const { procs: ps } of lists)
    for (const p of ps) {
      const id = parseIdent(p.identificacao);
      if (id) procs.set(`${id.numero}-${id.reissue}-${id.ano}`, p);
    }

  const wanted = [...groups.values()]
    .map((eds) => eds.slice().sort((a, b) => Number(a.reedicao ?? 0) - Number(b.reedicao ?? 0)))
    .filter((eds) => years.includes(Number(brDateToIso(eds[0].dataassinatura)!.slice(0, 4))))
    .filter((eds) => !only || only.includes(eds[0].numero))
    .slice(0, limit);
  const records = wanted.map((eds) => {
    const last = eds.at(-1)!;
    const proc = procs.get(`${Number(last.numero)}-${Number(last.reedicao ?? 0)}-${brDateToIso(last.dataassinatura)!.slice(0, 4)}`);
    return mpRecord(eds, proc);
  });
  return { records, failed: 0 };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  console.log(`Federal crawl ${opts.from}-${opts.to} [${opts.types.join(",")}]${opts.dryRun ? " (dry run)" : ""}`);
  const apis = makeApis(makeFetchJson());
  const store = await openStore(opts.dataDir);
  const years = range(opts.from, opts.to);
  const crawled: Policy[] = [];
  let failed = 0;

  for (const type of opts.types.filter((t): t is "LEI" | "LCP" => t !== "MPV"))
    for (const year of years) {
      const r = await crawlLaws(apis, type, year, opts.limit, opts.only);
      console.log(`  ${type} ${year}: ${r.records.length} records${r.failed ? `, ${r.failed} failed` : ""}`);
      crawled.push(...r.records);
      failed += r.failed;
    }
  if (opts.types.includes("MPV")) {
    const r = await crawlMps(apis, years, opts.limit, opts.only);
    console.log(`  MPV ${opts.from}-${opts.to}: ${r.records.length} records`);
    crawled.push(...r.records);
  }

  let written = 0;
  for (const rec of crawled) {
    const prev = store.get(rec.id);
    store.upsert(rec, { owner: true, preserve: prev?.curated ? ["title", "summary", "areas"] : [] });
    written++;
  }

  const withParty = crawled.filter((r) => r.authors.some((a) => a.kind !== "executive")).length;
  const unknownParty = crawled.filter((r) => r.authors.some((a) => (a.kind === "deputy" || a.kind === "senator") && !a.party)).length;
  console.log(`Total ${written} records; ${failed} failed; ${withParty} with legislative authors, ${unknownParty} with an author of unknown party.`);

  if (opts.dryRun) {
    for (const r of crawled.slice(0, 8)) console.log(JSON.stringify(r, null, 2));
    return;
  }
  await store.save();

  // A run that loses more than a tenth of its records is reported as failing on the site.
  const ok = crawled.length > 0 && failed <= crawled.length / 10;
  const all = store.all().filter((r) => r.level === "federal");
  const count = (re: RegExp) => all.filter((r) => r.sources.some((s) => re.test(s.url))).length;
  const finishedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const status = ok ? { status: "active" as const, lastSuccess: finishedAt } : { status: "failing" as const };
  await updateSource("senado", { ...status, lastRun: startedAt, records: count(/normas\.leg\.br|senado\.leg\.br/), crawler: "crawlers/federal/run.ts" });
  await updateSource("camara", { ...status, lastRun: startedAt, records: count(/camara\.leg\.br/), crawler: "crawlers/federal/run.ts" });
  if (!ok) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  if (!process.argv.includes("--dry-run"))
    for (const id of ["senado", "camara"]) await updateSource(id, { status: "failing", lastRun: now }).catch(() => {});
  process.exit(1);
});
