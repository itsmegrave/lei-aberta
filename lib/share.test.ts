import { test } from "node:test";
import assert from "node:assert/strict";
import { lawUrl, shareUrl } from "./share.ts";

test("share link prefers the Dub short link", () => {
  assert.equal(shareUrl("federal-lei-1-2000", { "federal-lei-1-2000": "https://dub.sh/abc" }, "https://x.org"), "https://dub.sh/abc");
});

test("share link falls back to the law page", () => {
  assert.equal(shareUrl("federal-lei-1-2000", {}, "https://x.org"), "https://x.org/lei/federal-lei-1-2000");
  assert.equal(lawUrl("a b", "https://x.org"), "https://x.org/lei/a%20b");
});
