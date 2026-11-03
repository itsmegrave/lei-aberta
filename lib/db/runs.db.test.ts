// Integration test for crawl_runs against a migrated Postgres (TEST_DATABASE_URL only). Uses test-db- crawlers only.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { like } from "drizzle-orm";
import { closeDb, getDb, type Db } from "./client.ts";
import { finishRun, latestRuns, startRun } from "./runs.ts";
import { crawlRuns } from "./schema.ts";

const C = "test-db-crawler";

describe("crawl runs", { skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not set" }, () => {
  let db: Db;
  const clean = () => db.delete(crawlRuns).where(like(crawlRuns.crawler, "test-db-%"));
  before(async () => {
    db = getDb(process.env.TEST_DATABASE_URL);
    await clean();
  });
  after(async () => {
    await clean();
    await closeDb();
  });

  test("start, finish and read the latest run per crawler", async () => {
    await startRun(db, { id: "test-db-1", crawler: C, runUrl: null, at: new Date("2026-11-01T06:30:00Z") });
    assert.equal(await finishRun(db, "test-db-1", "success", new Date("2026-11-01T07:00:00Z")), true);
    await startRun(db, { id: "test-db-2", crawler: C, runUrl: "https://github.com/x/y/actions/runs/2", at: new Date("2026-11-02T06:30:00Z") });

    let mine = (await latestRuns(db)).find((r) => r.crawler === C)!;
    assert.equal(mine.status, "running");
    assert.equal(mine.startedAt, "2026-11-02T06:30:00.000Z");
    assert.equal(mine.lastSuccessAt, "2026-11-01T07:00:00.000Z");
    assert.equal(mine.runUrl, "https://github.com/x/y/actions/runs/2");

    await finishRun(db, "test-db-2", "failure", new Date("2026-11-02T06:40:00Z"));
    mine = (await latestRuns(db)).find((r) => r.crawler === C)!;
    assert.equal(mine.status, "failure");
    assert.equal(mine.finishedAt, "2026-11-02T06:40:00.000Z");
    assert.equal(mine.lastSuccessAt, "2026-11-01T07:00:00.000Z");

    // Finishing a row that was never started reports it instead of inventing one.
    assert.equal(await finishRun(db, "test-db-missing", "success"), false);
  });
});
