// lib/data.ts on the sample catalog in lib/fixtures.
// Runs with --conditions=react-server so the "server-only" guard imports cleanly.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE } from "./listing.ts";

process.env.CATALOG_DIR = "lib/fixtures/catalog";
let data: typeof import("./data.ts");
before(async () => {
  data = await import("./data.ts");
});

// Runs first, before anything loads the whole catalog, so it exercises the one-year-file lookup.
test("findPolicy finds a law from its level and year file", async () => {
  const fs = await import("node:fs/promises");
  const [first] = JSON.parse(await fs.readFile("lib/fixtures/catalog/federal/2003.json", "utf8"));
  assert.deepEqual(await data.findPolicy(first.id), first);
  assert.equal(await data.findPolicy("federal-lei-999999-2003"), undefined);
  assert.equal(await data.findPolicy("nao-existe"), undefined);
});

test("the catalog reads every file in its index.json, newest first", async () => {
  const index = JSON.parse(await (await import("node:fs/promises")).readFile("lib/fixtures/catalog/index.json", "utf8")) as { updatedAt: string; files: { count: number }[] };
  const { policies, updatedAt, sample } = await data.loadCatalog();
  assert.equal(policies.length, index.files.reduce((n, f) => n + f.count, 0));
  assert.equal(updatedAt, index.updatedAt);
  assert.equal(sample, false);
  for (let i = 1; i < policies.length; i++) assert.ok(policies[i - 1].year >= policies[i].year, `order at ${i}`);
  assert.equal(new Set(policies.map((p) => p.id)).size, policies.length, "ids are unique");
  // Read once: later calls share the same promise.
  assert.equal(data.loadCatalog(), data.loadCatalog());
});

test("findPolicy and policyIds agree with the catalog", async () => {
  const { policies } = await data.loadCatalog();
  assert.deepEqual(await data.findPolicy(policies[3].id), policies[3]);
  assert.equal(await data.findPolicy("nao-existe"), undefined);
  assert.deepEqual(await data.policyIds(), policies.map((p) => p.id));
});

test("the listing pages the catalog and builds the index once", async () => {
  const l = await data.loadListing();
  assert.equal(l.rows.length, l.policies.length);
  assert.equal(l.pages, Math.ceil(l.policies.length / PAGE_SIZE));
  assert.deepEqual(l.page(1).map((p) => p.id), l.policies.slice(0, PAGE_SIZE).map((p) => p.id));
  assert.ok(l.page(1).every((p) => p.shareUrl?.includes("/l/")));
  assert.equal(l.page(l.pages + 1).length, 0);
  assert.equal(l.index(), l.index());
  assert.equal(l.overview.total, l.policies.length);
});

test("lastYearOf is this year unless the data goes further", () => {
  const now = new Date().getFullYear();
  assert.equal(data.lastYearOf([]), now);
  assert.equal(data.lastYearOf([{ year: now + 2 } as never]), now + 2);
});

test("party stats cover every law by id", async () => {
  const { byId, stats } = await data.loadPartyStats();
  assert.equal(byId.size, (await data.loadCatalog()).policies.length);
  assert.ok(stats.size > 0);
});
