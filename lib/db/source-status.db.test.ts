// source_status against a migrated Postgres (TEST_DATABASE_URL only). Uses test-db- ids only.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { like } from "drizzle-orm";
import { lastSuccess } from "../../crawlers/lib/cursor.ts";
import { readSourcesWithState, updateSource } from "../sources-store.ts";
import { closeDb, getDb } from "./client.ts";
import { sourceStatus } from "./schema.ts";
import { readSourceState } from "./source-status.ts";

const URL = process.env.TEST_DATABASE_URL;
const manifest = {
  id: "test-db-src", name: "Fonte de teste", publisher: "Teste", url: "https://example.gov.br", levels: ["federal"],
  coverage: ["Brasil"], covers: ["lei"], description: "Só para testes.", status: "building", lastSuccess: "2026-10-31T06:30:00Z",
};

describe("source status in Postgres", { skip: !URL && "TEST_DATABASE_URL is not set" }, () => {
  let dir: string;
  const clean = async () => {
    await getDb(URL).delete(sourceStatus).where(like(sourceStatus.id, "test-db-%"));
    await closeDb();
  };
  before(async () => {
    await clean();
    dir = await mkdtemp(path.join(tmpdir(), "src-db-"));
    await writeFile(path.join(dir, "test-db-src.json"), JSON.stringify(manifest));
  });
  after(clean);

  test("crawls save their state in the database and read it back as the cursor", async () => {
    // Before any database row, the file's cursor is used.
    assert.equal(await lastSuccess("test-db-src", dir, URL), "2026-10-31T06:30:00Z");
    await updateSource("test-db-src", { status: "active", records: 4, lastRun: "2026-11-03T06:30:00Z", lastSuccess: "2026-11-03T06:30:00Z" }, dir, URL);
    assert.deepEqual(await readSourceState(getDb(URL), "test-db-src"), {
      status: "active", records: 4, lastRun: "2026-11-03T06:30:00Z", lastSuccess: "2026-11-03T06:30:00Z",
    });
    await closeDb();
    // Simulate the next run's fresh checkout: the file still has the old cursor.
    await writeFile(path.join(dir, "test-db-src.json"), JSON.stringify(manifest));
    assert.equal(await lastSuccess("test-db-src", dir, URL), "2026-11-03T06:30:00Z");
    // A failed run keeps the cursor and the count from the database, not from the stale file.
    await updateSource("test-db-src", { status: "failing", lastRun: "2026-11-04T06:30:00Z" }, dir, URL);
    const file = JSON.parse(await readFile(path.join(dir, "test-db-src.json"), "utf8"));
    assert.equal(file.lastSuccess, "2026-11-03T06:30:00Z");
    assert.equal(file.records, 4);

    const [site] = await readSourcesWithState(URL, dir);
    assert.equal(site.status, "failing");
    assert.equal(site.name, "Fonte de teste");
    await closeDb();
  });
});
