import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { finishRun, latestRuns, startRun } from "./crawl-runs-store.ts";

test("start, finish and read the latest run per crawler", async () => {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "runs-")), "status", "runs.json");
  const C = "crawlers/federal/run.ts";
  await startRun({ id: "1", crawler: C, runUrl: null, at: new Date("2026-11-01T06:30:00Z") }, file);
  assert.equal(await finishRun("1", "success", new Date("2026-11-01T07:00:00Z"), file), true);
  await startRun({ id: "2", crawler: C, runUrl: "https://github.com/x/y/actions/runs/2", at: new Date("2026-11-02T06:30:00Z") }, file);

  let [mine] = await latestRuns(file);
  assert.equal(mine.status, "running");
  assert.equal(mine.startedAt, "2026-11-02T06:30:00.000Z");
  assert.equal(mine.lastSuccessAt, "2026-11-01T07:00:00.000Z");
  assert.equal(mine.runUrl, "https://github.com/x/y/actions/runs/2");
  assert.ok(!("id" in mine));

  await finishRun("2", "failure", new Date("2026-11-02T06:40:00Z"), file);
  [mine] = await latestRuns(file);
  assert.equal(mine.status, "failure");
  assert.equal(mine.finishedAt, "2026-11-02T06:40:00.000Z");
  assert.equal(mine.lastSuccessAt, "2026-11-01T07:00:00.000Z");

  // Finishing a run that was never started reports it instead of inventing one.
  assert.equal(await finishRun("missing", "success", new Date(), file), false);
  // Each crawler keeps its own entry.
  await startRun({ id: "3", crawler: "crawlers/estadual/run.ts", runUrl: null }, file);
  assert.equal((await latestRuns(file)).length, 2);
});
