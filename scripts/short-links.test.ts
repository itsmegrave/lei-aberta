import { test } from "node:test";
import assert from "node:assert/strict";
import { linkBody, pickMissing } from "./short-links.ts";

const laws = [
  { id: "a", year: 1990 },
  { id: "b", year: 2020, signedAt: "2020-07-15" },
  { id: "c", year: 2020, signedAt: "2020-12-01" },
  { id: "d", year: 2005 },
];

test("picks laws without a short link, newest first, capped", () => {
  assert.deepEqual(pickMissing(laws, { c: "https://dub.sh/x" }, 2).map((l) => l.id), ["b", "d"]);
  assert.deepEqual(pickMissing(laws, {}, 0), []);
});

test("link body points at the law page and tags it", () => {
  assert.deepEqual(linkBody("b", "https://x.org", "lei.to"), {
    url: "https://x.org/lei/b",
    externalId: "b",
    tagNames: ["lei-aberta"],
    domain: "lei.to",
  });
  assert.equal("domain" in linkBody("b", "https://x.org"), false);
});
