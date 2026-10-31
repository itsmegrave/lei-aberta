import { test } from "node:test";
import assert from "node:assert/strict";
import { assertUniqueCodes, lawPath, lawUrl, shortCode, shortPath, shortUrl, SITE_URL } from "./share.ts";

test("short code is 7 base-36 characters and stable", () => {
  const c = shortCode("federal-lei-14026-2020");
  assert.match(c, /^[0-9a-z]{7}$/);
  assert.equal(shortCode("federal-lei-14026-2020"), c);
  assert.notEqual(shortCode("federal-lei-14026-2021"), c);
});

test("short and full links", () => {
  assert.equal(shortUrl("x", "https://a.org"), `https://a.org/l/${shortCode("x")}`);
  assert.equal(lawUrl("a b", "https://a.org"), "https://a.org/lei/a%20b");
});

test("no collisions across a large synthetic catalog", () => {
  const ids: string[] = [];
  for (let y = 1988; y <= 2026; y++) for (let n = 1; n <= 3000; n++) ids.push(`federal-lei-${n}-${y}`);
  assert.equal(assertUniqueCodes(ids).size, ids.length);
});

test("paths encode the id and the short path uses the code", () => {
  assert.equal(lawPath("federal-lei-1-2000"), "/lei/federal-lei-1-2000");
  assert.equal(lawPath("a/b?c"), "/lei/a%2Fb%3Fc");
  assert.equal(shortPath("x"), `/l/${shortCode("x")}`);
});

test("codes are padded to 7 characters even for small hashes", () => {
  for (let i = 0; i < 2000; i++) assert.equal(shortCode(`id-${i}`).length, 7);
  assert.match(shortCode(""), /^[0-9a-z]{7}$/);
  assert.match(shortCode("lei-ção-ÁÉ"), /^[0-9a-z]{7}$/);
});

test("the same id twice is not a collision; the map goes code -> id", () => {
  const m = assertUniqueCodes(["a", "a", "b"]);
  assert.equal(m.size, 2);
  assert.equal(m.get(shortCode("a")), "a");
});

test("site URL has no trailing slash", () => {
  assert.ok(!SITE_URL.endsWith("/"));
  assert.match(SITE_URL, /^https?:\/\//);
});
