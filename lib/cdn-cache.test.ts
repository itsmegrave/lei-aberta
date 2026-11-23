import { test } from "node:test";
import assert from "node:assert/strict";
import { CDN_CACHE_HEADER, cdnCache, cdnHeaders, LAW_CACHE, NEWS_CACHE, STATUS_CACHE } from "./cdn-cache.ts";

test("cdnCache builds a public directive with stale-while-revalidate", () => {
  assert.equal(cdnCache(60), "public, max-age=60, stale-while-revalidate=60");
  assert.equal(cdnCache(10, 5), "public, max-age=10, stale-while-revalidate=5");
});

test("cache lengths match how often each kind of data changes", () => {
  assert.match(LAW_CACHE, /max-age=604800\b/);
  assert.match(STATUS_CACHE, /max-age=60\b/);
  assert.match(NEWS_CACHE, /max-age=1800\b/);
});

test("route handler headers cache on the CDN only", () => {
  const h = cdnHeaders(STATUS_CACHE);
  assert.equal(h[CDN_CACHE_HEADER], STATUS_CACHE);
  assert.match(h["Cache-Control"], /max-age=0/);
});
