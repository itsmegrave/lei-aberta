import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FILTERS, toRow } from "./catalog.ts";
import { decodeIndex, encodeIndex, pageCount, pageFile, pageOfPos, pageWindow, readUrlState, toCard, writeUrlState } from "./listing.ts";
import type { Policy } from "./types.ts";

const law: Policy = {
  id: "x", level: "federal", jurisdiction: "Brasil", type: "lei", number: "8.080", title: "Lei Orgânica da Saúde", summary: "SUS",
  year: 1990, presentedAt: "1989-01-01", status: "sancionada", areas: ["saude"], parties: [],
  authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }],
  executive: { name: "Fernando Collor", office: "Presidente", party: "PRN" }, sources: [{ label: "Planalto", url: "https://x" }], curated: true,
};

test("the index round-trips every row", () => {
  const rows = [toRow(law, 0), toRow({ ...law, id: "y", level: "estadual", authors: [{ name: "Ana", kind: "state-deputy", party: "PT", uf: "SP" }] }, 1)];
  const file = JSON.parse(JSON.stringify(encodeIndex(rows)));
  assert.deepEqual(decodeIndex(file), rows);
  assert.ok(file.strings.length < 12, "strings are shared, not repeated");
});

test("pages are 24 laws, and a position maps to its page file", () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(24), 1);
  assert.equal(pageCount(25), 2);
  assert.equal(pageOfPos(0), 1);
  assert.equal(pageOfPos(23), 1);
  assert.equal(pageOfPos(24), 2);
});

test("cards drop fields the page never shows", () => {
  const c = toCard(law);
  assert.equal(c.presentedAt, null);
  assert.equal("curated" in c, false);
  assert.equal(c.title, law.title);
  assert.match(c.shareUrl ?? "", /\/l\/[0-9a-z]{7}$/);
});

test("filters and page round-trip through the URL in Portuguese", () => {
  const f = { ...EMPTY_FILTERS, q: "saúde", level: "federal" as const, executive: "Poder Executivo", year: 1990 };
  const url = writeUrlState(f, 3);
  assert.match(url, /nivel=federal/);
  assert.match(url, /pagina=3/);
  assert.deepEqual(readUrlState(url), { filters: f, page: 3 });
  assert.equal(writeUrlState(EMPTY_FILTERS, 1), "");
});

test("bad URL values fall back to defaults", () => {
  assert.deepEqual(readUrlState("?pagina=abc&nivel=lua&ano=x"), { filters: EMPTY_FILTERS, page: 1 });
  assert.equal(readUrlState("?pagina=0").page, 1);
});

test("the pager shows ends, neighbours and gaps", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 10), [1, 2, 3, null, 10]);
  assert.deepEqual(pageWindow(6, 12), [1, null, 4, 5, 6, 7, 8, null, 12]);
  assert.deepEqual(pageWindow(4, 10), [1, 2, 3, 4, 5, 6, null, 10]);
});

test("an empty catalog still has one page; page files are 1-based", () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(24), 1);
  assert.equal(pageCount(25), 2);
  assert.equal(pageFile(1), "pagina-1.json");
  assert.equal(pageOfPos(0), 1);
  assert.equal(pageOfPos(23), 1);
  assert.equal(pageOfPos(24), 2);
});

test("URL state trims values, skips page 1 and drops blanks", () => {
  assert.equal(writeUrlState({ ...EMPTY_FILTERS, q: "  ", area: " saude " }, 1), "?tema=saude");
  assert.equal(writeUrlState(EMPTY_FILTERS, 1), "");
  assert.equal(writeUrlState({ ...EMPTY_FILTERS, year: 0 }, 2), "?ano=0&pagina=2");
  assert.deepEqual(readUrlState("?q=%C3%A1gua+pot%C3%A1vel").filters.q, "água potável");
  assert.equal(readUrlState("?pagina=2.5").page, 1);
  assert.equal(readUrlState("?pagina=-3").page, 1);
});

test("the pager window handles small and edge cases", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 10), [1, 2, 3, null, 10]);
  assert.deepEqual(pageWindow(10, 10), [1, null, 8, 9, 10]);
  // A gap of exactly one page shows the page instead of "…".
  assert.deepEqual(pageWindow(5, 10), [1, 2, 3, 4, 5, 6, 7, null, 10]);
});
