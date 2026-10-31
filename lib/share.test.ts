import { test } from "node:test";
import assert from "node:assert/strict";
import { assertUniqueCodes, lawUrl, shortCode, shortUrl } from "./share.ts";

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
