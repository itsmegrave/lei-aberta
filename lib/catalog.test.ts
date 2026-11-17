import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters as filterRows, authorKeys, countBy, EMPTY_FILTERS, executiveKey, isFiltered, lawState, NO_PARTY, overview, UNKNOWN_PARTY, perAuthorState as stateRows, perYear, toRow, type Filters } from "./catalog.ts";
import { partyScore, spectrumColor } from "./party-spectrum.ts";
import type { Policy } from "./types.ts";

const base: Policy = {
  id: "x", level: "federal", jurisdiction: "Brasil", type: "lei", number: "1", title: "Lei de Teste", summary: "Saúde pública",
  year: 2000, presentedAt: null, status: "sancionada", areas: ["saude"], parties: ["PT"],
  authors: [{ name: "Fulano", kind: "deputy", party: "PT", uf: "RS" }],
  executive: { name: "Beltrano", office: "Presidente", party: "PSDB" }, sources: [{ label: "x", url: "https://x" }],
};
// The page filters compact rows; build them from records the way the build does.
const ids = new Map<number, string>();
const rowsOf = (ps: Policy[]) => ps.map((p, i) => (ids.set(i, p.id), toRow(p, i)));
const applyFilters = (ps: Policy[], f: Filters, skip?: keyof Filters) => filterRows(rowsOf(ps), f, skip).map((r) => ({ ...r, id: ids.get(r.pos) }));
const perAuthorState = (ps: Policy[]) => stateRows(rowsOf(ps));

const execBill: Policy = { ...base, id: "y", year: 2004, parties: [], authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }], executive: { name: "C", office: "Presidente", party: null } };

test("author party and executive party stay separate", () => {
  assert.deepEqual(authorKeys(base), ["PT"]);
  assert.equal(executiveKey(base), "PSDB");
  assert.deepEqual(authorKeys(execBill), ["Poder Executivo"]);
  assert.equal(executiveKey(execBill), "Sem partido");
});

test("institutions and unknown parties get their own buckets", () => {
  const committee = { ...base, parties: [], authors: [{ name: "CCJ", kind: "committee", party: null, uf: null }] };
  const unknown = { ...base, parties: [], authors: [{ name: "Fulana", kind: "deputy", party: null, uf: "SP" }] };
  assert.deepEqual(authorKeys(committee), ["Comissão"]);
  assert.deepEqual(authorKeys(unknown), ["Partido não identificado"]);
});

test("filters by executive party without touching author party", () => {
  const rows = applyFilters([base, execBill], { ...EMPTY_FILTERS, executive: "PSDB" });
  assert.deepEqual(rows.map((r) => r.id), ["x"]);
  assert.equal(applyFilters([base, execBill], { ...EMPTY_FILTERS, author: "PSDB" }).length, 0);
});

test("search ignores accents and case", () => {
  assert.equal(applyFilters([base], { ...EMPTY_FILTERS, q: "SAUDE" }).length, 1);
});

test("everyday words find the topic", () => {
  assert.equal(applyFilters([base], { ...EMPTY_FILTERS, q: "saúde" }).length, 1);
  const tech = { ...base, areas: ["tecnologia"], summary: "Regras para a rede" };
  assert.equal(applyFilters([tech], { ...EMPTY_FILTERS, q: "internet" }).length, 1);
});

test("author state counts skip executive bills and filter by UF", () => {
  assert.deepEqual([...perAuthorState([base, execBill])], [["RS", 1]]);
  assert.equal(applyFilters([base, execBill], { ...EMPTY_FILTERS, uf: "RS" }).length, 1);
});

test("skip keeps the chart's own dimension unfiltered", () => {
  assert.equal(applyFilters([base, execBill], { ...EMPTY_FILTERS, year: 2000 }, "year").length, 2);
});

test("countBy sorts by count then name", () => {
  assert.deepEqual(countBy([base, execBill, base], authorKeys), [{ key: "PT", value: 2 }, { key: "Poder Executivo", value: 1 }]);
});

test("perYear covers every year from 1988", () => {
  const y = perYear([base], 2001);
  assert.equal(y.length, 14);
  assert.equal(y.find((r) => r.year === 2000)?.federal, 1);
});

test("party scores come from the survey, renames map to the same party", () => {
  assert.equal(partyScore("PT"), 2.97);
  assert.equal(partyScore("PMDB"), partyScore("MDB"));
  assert.equal(partyScore("PFL"), 8.57);
  assert.equal(partyScore("XYZ"), null);
  assert.equal(partyScore(null), null);
});

test("spectrum color hits the stops", () => {
  assert.equal(spectrumColor(0), "#c8352b");
  assert.notEqual(spectrumColor(3), spectrumColor(7));
  assert.equal(spectrumColor(5), "#8f8e88");
  assert.equal(spectrumColor(10), "#2a6fd6");
  assert.equal(spectrumColor(null), "#d4d3cd");
});

test("type labels cover MPs and both complementar spellings", async () => {
  const { typeLabel } = await import("./vocab.ts");
  assert.equal(typeLabel("medida-provisoria"), "MP");
  assert.equal(typeLabel("lei-complementar", true), "Lei Complementar");
  assert.equal(typeLabel("lei complementar"), "Lei Compl.");
});

test("overview counts each chart without its own filter", () => {
  const rows = rowsOf([base, execBill]);
  const { overview: o, matches } = overview(rows, { ...EMPTY_FILTERS, year: 2000 }, 2004);
  assert.equal(o.total, 1);
  assert.deepEqual(matches.map((r) => r.pos), [0]);
  assert.equal(o.years.find((y) => y.year === 2004)?.federal, 1);
  assert.deepEqual(o.author, [{ key: "PT", value: 1 }]);
  assert.equal(o.officialPct, 100);
  assert.deepEqual([o.minYear, o.maxYear], [2000, 2000]);
});

test("isFiltered ignores blank search and treats year 0 as set", () => {
  assert.equal(isFiltered(EMPTY_FILTERS), false);
  assert.equal(isFiltered({ ...EMPTY_FILTERS, q: "   " }), false);
  assert.equal(isFiltered({ ...EMPTY_FILTERS, uf: "SP" }), true);
  assert.equal(isFiltered({ ...EMPTY_FILTERS, year: 0 }), true);
});

test("a law with no authors counts as unknown party; no executive is 'sem partido'", () => {
  const r = toRow({ ...base, authors: [], executive: null });
  assert.deepEqual(r.authors, [UNKNOWN_PARTY]);
  assert.equal(r.executive, NO_PARTY);
  assert.deepEqual(r.ufs, []);
});

test("rows dedupe states and normalize search text", () => {
  const r = toRow({
    ...base,
    title: "Proteção à Criança",
    authors: [{ name: "José", kind: "deputy", party: "PT", uf: "SP" }, { name: "Ângela", kind: "deputy", party: "PT", uf: "SP" }],
  });
  assert.deepEqual(r.ufs, ["SP"]);
  assert.deepEqual(r.authors, ["PT"]);
  assert.match(r.text, /protecao a crianca/);
  assert.match(r.text, /angela/);
});

test("overview of nothing is zeros, not NaN", () => {
  const { overview: o, matches } = overview([], EMPTY_FILTERS, 1990);
  assert.equal(matches.length, 0);
  assert.equal(o.total, 0);
  assert.equal(o.officialPct, 0);
  assert.equal(o.minYear, null);
  assert.equal(o.years.length, 3);
});

test("overview gives the year range and share with an official link", () => {
  const rows = rowsOf([{ ...base, year: 1995 }, { ...base, id: "b", year: 2010, sources: [] }, { ...base, id: "c", year: 2001 }]);
  const { overview: o } = overview(rows, EMPTY_FILTERS, 2010);
  assert.equal(o.minYear, 1995);
  assert.equal(o.maxYear, 2010);
  assert.equal(o.officialPct, 67);
  assert.equal(o.themes, 1);
});

test("perYear ignores years outside 1988..lastYear", () => {
  const ys = perYear([{ year: 1987, level: "federal" }, { year: 2031, level: "federal" }, { year: 1988, level: "municipal" }], 1990);
  assert.deepEqual(ys[0], { year: 1988, federal: 0, estadual: 0, municipal: 1 });
  assert.equal(ys.reduce((n, y) => n + y.federal, 0), 0);
});

test("a state or municipal law belongs to its state; federal laws to none", () => {
  assert.equal(lawState({ level: "federal", jurisdiction: "Brasil" }), "");
  assert.equal(lawState({ level: "estadual", jurisdiction: "São Paulo" }), "SP");
  assert.equal(lawState({ level: "estadual", jurisdiction: "Lua" }), "");
  assert.equal(lawState({ level: "municipal", jurisdiction: "Campinas (SP)" }), "SP");
  assert.equal(lawState({ level: "municipal", jurisdiction: "Lugar (XX)" }), "");
});

test("the state filter matches a state's own laws and laws its lawmakers proposed", () => {
  const governorBill = toRow({ ...base, id: "g", level: "estadual", jurisdiction: "Piauí", authors: [{ name: "Gov", kind: "executive", party: null, uf: null }] }, 0);
  const deputyBill = toRow({ ...base, id: "d", authors: [{ name: "Ana", kind: "deputy", party: "PT", uf: "PI" }] }, 1);
  const other = toRow({ ...base, id: "o", authors: [{ name: "Bia", kind: "deputy", party: "PT", uf: "SP" }] }, 2);
  assert.equal(governorBill.state, "PI");
  assert.deepEqual(filterRows([governorBill, deputyBill, other], { ...EMPTY_FILTERS, uf: "PI" }).map((r) => r.pos), [0, 1]);
  // The map still counts only lawmakers' states.
  assert.deepEqual([...stateRows([governorBill, deputyBill, other])], [["PI", 1], ["SP", 1]]);
});
