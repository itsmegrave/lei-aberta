import { test } from "node:test";
import assert from "node:assert/strict";
import { authorKeys, executiveKey } from "./catalog.ts";
import { readUrlState } from "./listing.ts";
import { partyScore } from "./party-spectrum.ts";
import { currentName, formerCodes, partyBySlug, partyOf, PARTIES } from "./parties.ts";
import type { Policy } from "./types.ts";

test("charts use the party's current name", () => {
  assert.equal(currentName("PMDB"), "MDB");
  assert.equal(currentName("PFL"), "União Brasil");
  assert.equal(currentName("DEM"), "União Brasil");
  assert.equal(currentName("PSL"), "União Brasil");
  assert.equal(currentName("UNIÃO"), "União Brasil");
  assert.equal(currentName("PPS"), "Cidadania");
  assert.equal(currentName("CIDADANIA"), "Cidadania");
  assert.equal(currentName("PRN"), "Agir");
  assert.equal(currentName("PR"), "PL");
  assert.equal(currentName("PPB"), "PP");
  assert.equal(currentName("PODE"), "Podemos");
  assert.equal(currentName("REPUBLICANOS"), "Republicanos");
  assert.equal(currentName("PT"), "PT");
  assert.equal(currentName("XYZ"), "XYZ");
});

test("codes reused by different parties are split by year", () => {
  assert.equal(currentName("PCB", 1991), "Cidadania");
  assert.equal(currentName("PCB", 2010), "PCB");
  assert.equal(currentName("PSD", 2000), "PRD");
  assert.equal(currentName("PSD", 2015), "PSD");
  assert.equal(currentName("PSD"), "PSD");
  assert.equal(currentName("PST", 1994), "PP");
  assert.equal(currentName("PST", 2001), "PL");
});

test("the record keeps the old party; charts group by the current one", () => {
  const p: Policy = {
    id: "x", level: "federal", jurisdiction: "Brasil", type: "lei", title: "T", summary: "S", year: 1995, presentedAt: null,
    status: "sancionada", areas: [], parties: ["PFL"], authors: [{ name: "A", kind: "deputy", party: "PFL", uf: "BA" }],
    executive: { name: "B", office: "Presidente", party: "PMDB" }, sources: [],
  };
  assert.deepEqual(authorKeys(p), ["União Brasil"]);
  assert.equal(executiveKey(p), "MDB");
  assert.equal(p.authors[0].party, "PFL");
  assert.deepEqual(authorKeys({ ...p, authors: [{ name: "A", kind: "deputy", party: "S/Partido", uf: "SP" }] }), ["Sem partido"]);
});

test("old filter links still find the party", () => {
  assert.equal(readUrlState("?autor=PMDB&executivo=PFL").filters.author, "MDB");
  assert.equal(readUrlState("?autor=PMDB&executivo=PFL").filters.executive, "União Brasil");
});

test("scores: renames keep theirs, post-survey mergers get none, old codes keep their own", () => {
  assert.equal(partyScore("MDB"), 7.01);
  assert.equal(partyScore("Cidadania"), partyScore("PPS"));
  assert.equal(partyScore("PL"), partyScore("PR"));
  assert.equal(partyScore("Podemos"), 7.24);
  assert.equal(partyScore("União Brasil"), null);
  assert.equal(partyScore("PRD"), null);
  assert.equal(partyScore("PFL"), 8.57);
  assert.equal(partyScore("PSL"), 8.11);
  assert.equal(partyScore("PSD", 2015), 7.09);
});

test("directory entries are complete and consistent", () => {
  const slugs = new Set<string>();
  const numbers = new Set<number>();
  for (const p of PARTIES) {
    assert.match(p.slug, /^[a-z0-9-]+$/);
    assert.ok(!slugs.has(p.slug), p.slug);
    assert.ok(!numbers.has(p.number), String(p.number));
    slugs.add(p.slug);
    numbers.add(p.number);
    assert.match(p.registeredAt, /^\d{4}-\d{2}-\d{2}$/);
    if (p.website) assert.match(p.website, /^https:\/\//);
    assert.ok(p.about.length > 0 && p.about.length < 200, p.slug);
    assert.ok(p.history.length > 0, p.slug);
    assert.equal(partyOf(p.short), p);
    if (p.survey) assert.notEqual(partyScore(p.short), null, p.slug);
  }
  assert.equal(PARTIES.length, 30);
  assert.deepEqual(formerCodes("uniao").sort(), ["DEM", "DEMOCRATAS", "PFL", "PSL", "UNIÃO"]);
  assert.equal(partyBySlug("mdb")?.short, "MDB");
});

test("party stats count proposed and signed separately, under the current name", async () => {
  const { partyStats } = await import("./party-stats.ts");
  const law = (id: string, year: number, author: string | null, exec: string | null): Policy => ({
    id, level: "federal", jurisdiction: "Brasil", type: "lei", title: id, summary: "", year, presentedAt: null, status: "sancionada",
    areas: ["saude"], parties: [], authors: [{ name: "A", kind: "deputy", party: author, uf: "SP" }],
    executive: { name: "P", office: "Presidente", party: exec }, sources: [],
  });
  const s = partyStats([law("a", 1995, "PMDB", "PSDB"), law("b", 2020, "MDB", "MDB"), law("c", 2021, "PT", "PMDB")], 2021);
  const mdb = s.get("mdb")!;
  assert.equal(mdb.proposed, 2);
  assert.equal(mdb.signed, 2);
  assert.deepEqual(mdb.recent, ["c", "b", "a"]);
  assert.deepEqual(mdb.codes.map((c) => [c.code, c.proposed, c.signed]), [["PMDB", 1, 1], ["MDB", 1, 1]]);
  assert.equal(mdb.years.find((y) => y.year === 1995)!.proposed, 1);
  assert.deepEqual(mdb.topics, [{ key: "saude", value: 2 }]);
  assert.equal(s.get("psdb")!.signed, 1);
  assert.equal(s.get("psdb")!.proposed, 0);
});
