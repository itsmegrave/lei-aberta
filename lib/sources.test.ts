import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sortSources, timeAgo, validateSource, type DataSource } from "./sources.ts";
import { readFile } from "node:fs/promises";
import { readSources, readSourcesWithState, updateSource } from "./sources-store.ts";

const ok: DataSource = {
  id: "senado", name: "Senado Federal", publisher: "Senado Federal", url: "https://legis.senado.leg.br/dadosabertos",
  levels: ["federal"], coverage: ["Brasil"], covers: ["lei"], description: "Projetos e leis.", status: "planned",
};

test("valid manifest passes, file name must match id", () => {
  assert.deepEqual(validateSource(ok, "senado.json"), []);
  assert.ok(validateSource(ok, "other.json").length);
});

test("active needs lastSuccess and ISO timestamps", () => {
  assert.ok(validateSource({ ...ok, status: "active" }).some((e) => e.includes("lastSuccess")));
  assert.deepEqual(validateSource({ ...ok, status: "active", lastSuccess: "2026-10-31T03:00:00Z" }), []);
  assert.ok(validateSource({ ...ok, lastRun: "ontem" }).length);
});

test("sort puts active first", () => {
  const list = sortSources([ok, { ...ok, id: "b", name: "B", status: "active", lastSuccess: "2026-10-31T03:00:00Z" }]);
  assert.equal(list[0].id, "b");
});

test("timeAgo speaks Portuguese", () => {
  const now = Date.parse("2026-10-31T12:00:00Z");
  assert.equal(timeAgo("2026-10-31T09:00:00Z", now), "há 3 horas");
  assert.equal(timeAgo("2026-10-29T12:00:00Z", now), "anteontem");
});

test("updateSource merges, validates and round-trips", async () => {
  const dir = path.join(await mkdtemp(path.join(tmpdir(), "src-")), "sources");
  await updateSource("senado", { ...ok }, dir);
  await updateSource("senado", { status: "active", records: 5, lastRun: "2026-10-31T03:00:00Z", lastSuccess: "2026-10-31T03:00:00Z" }, dir);
  const [s] = await readSources(dir);
  assert.equal(s.records, 5);
  assert.equal(s.name, "Senado Federal");
  await assert.rejects(updateSource("x", { status: "active" }, dir));
  assert.deepEqual(await readdir(dir), ["senado.json"]);
});

test("crawl state goes to status/sources.json and wins over an older manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "src-"));
  const dir = path.join(root, "sources");
  await updateSource("senado", { ...ok }, dir);
  await updateSource("senado", { status: "active", records: 7, lastRun: "2026-11-10T06:30:00Z", lastSuccess: "2026-11-10T06:30:00Z" }, dir);
  const state = JSON.parse(await readFile(path.join(root, "status", "sources.json"), "utf8"));
  assert.deepEqual(state.senado, { status: "active", records: 7, lastRun: "2026-11-10T06:30:00Z", lastSuccess: "2026-11-10T06:30:00Z" });
  // main's manifest is older (as after a fresh checkout); the build lays the branch's state over it.
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(dir, "senado.json"), JSON.stringify(ok));
  const [s] = await readSourcesWithState(dir);
  assert.equal(s.status, "active");
  assert.equal(s.records, 7);
  assert.equal(s.name, "Senado Federal");
  // And the next run starts from it, not from the manifest.
  const { lastSuccess } = await import("../crawlers/lib/cursor.ts");
  assert.equal(await lastSuccess("senado", dir), "2026-11-10T06:30:00Z");
});

test("withState lays crawl fields over the manifest and ignores invalid ones", async () => {
  const { stateOf, withState } = await import("./sources.ts");
  const s = withState(ok, { status: "active", lastSuccess: "2026-11-03T06:30:00Z", records: 9 });
  assert.equal(s.status, "active");
  assert.equal(s.records, 9);
  assert.equal(s.name, "Senado Federal");
  // "active" without lastSuccess is invalid: keep the manifest.
  assert.equal(withState(ok, { status: "active" }).status, "planned");
  // Only crawl fields are kept.
  assert.deepEqual(stateOf({ ...ok, records: 3 }), { status: "planned", records: 3 });
});
