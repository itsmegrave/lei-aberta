import { test } from "node:test";
import assert from "node:assert/strict";
import { isCollecting, liveSource, outcomeStatus, runId, runUrl, type CrawlRun } from "./crawl-runs.ts";
import type { DataSource } from "./sources.ts";

const src: DataSource = {
  id: "senado", name: "Senado Federal", publisher: "Senado Federal", url: "https://legis.senado.leg.br/dadosabertos",
  levels: ["federal"], coverage: ["Brasil"], covers: ["lei"], description: "Leis.", status: "active",
  lastRun: "2026-11-02T06:30:00Z", lastSuccess: "2026-11-02T06:30:00Z", crawler: "crawlers/federal/run.ts",
};
const run = (over: Partial<CrawlRun> = {}): CrawlRun => ({
  crawler: "crawlers/federal/run.ts", status: "running", startedAt: "2026-11-03T06:30:00Z", finishedAt: null,
  runUrl: "https://github.com/itsmegrave/lei-aberta/actions/runs/1", lastSuccessAt: "2026-11-02T07:10:00Z", ...over,
});
const at = (iso: string) => Date.parse(iso);

test("a running crawl marks its sources as collecting", () => {
  const l = liveSource(src, [run()], at("2026-11-03T07:00:00Z"));
  assert.equal(l.collecting, true);
  assert.equal(l.startedAt, "2026-11-03T06:30:00Z");
  assert.equal(l.status, "active");
  // The last successful run is newer than the manifest.
  assert.equal(l.lastSuccess, "2026-11-02T07:10:00Z");
});

test("other crawlers and sources without a crawler are left alone", () => {
  assert.equal(liveSource({ ...src, crawler: "crawlers/estadual/run.ts" }, [run()], at("2026-11-03T07:00:00Z")).collecting, false);
  assert.equal(liveSource({ ...src, crawler: null }, [run()], at("2026-11-03T07:00:00Z")).collecting, false);
  assert.equal(liveSource(src, [], 0).lastSuccess, src.lastSuccess);
});

test("a run left running past six hours is not live", () => {
  assert.equal(isCollecting(run(), at("2026-11-03T12:29:00Z")), true);
  assert.equal(isCollecting(run(), at("2026-11-03T12:31:00Z")), false);
});

test("a failure newer than the manifest shows as failing, a later success clears it", () => {
  const failed = run({ status: "failure", finishedAt: "2026-11-03T07:00:00Z" });
  assert.equal(liveSource(src, [failed], at("2026-11-03T08:00:00Z")).status, "failing");
  // An old failure the manifest already reflects changes nothing.
  assert.equal(liveSource(src, [run({ status: "failure", finishedAt: "2026-11-01T07:00:00Z" })], at("2026-11-03T08:00:00Z")).status, "active");
  const recovered = run({ status: "success", finishedAt: "2026-11-03T07:00:00Z", lastSuccessAt: "2026-11-03T07:00:00Z" });
  assert.equal(liveSource({ ...src, status: "failing" }, [recovered], at("2026-11-03T08:00:00Z")).status, "active");
  // Building and planned sources keep their label.
  assert.equal(liveSource({ ...src, status: "building" }, [recovered], at("2026-11-03T08:00:00Z")).status, "building");
});

test("run ids and links come from the GitHub Actions environment", () => {
  const env = { GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "2", GITHUB_REPOSITORY: "itsmegrave/lei-aberta", GITHUB_SERVER_URL: "https://github.com" };
  assert.equal(runId(env, "crawlers/federal/run.ts"), "42-2-crawlers/federal/run.ts");
  assert.equal(runUrl(env), "https://github.com/itsmegrave/lei-aberta/actions/runs/42");
  assert.equal(runId({}, "x"), null);
  assert.equal(runUrl({}), null);
});

test("step outcomes map to run statuses", () => {
  assert.equal(outcomeStatus("success"), "success");
  assert.equal(outcomeStatus("failure"), "failure");
  assert.equal(outcomeStatus("cancelled"), "cancelled");
  assert.equal(outcomeStatus("skipped"), "cancelled");
});
