import { test } from "node:test";
import assert from "node:assert/strict";
import type { Policy } from "./types";
import { jsonLdString, lawDescription, lawJsonLd, lawTitle, siteJsonLd, sitemapChunks, sitemapIndexXml, urlsetXml } from "./seo.ts";

const law: Policy = {
  id: "federal-lei-13709-2018",
  level: "federal",
  jurisdiction: "Brasil",
  type: "lei",
  number: "13.709",
  title: "Lei Geral de Proteção de Dados (LGPD)",
  summary: "Regula como empresas e governos coletam e usam dados pessoais.",
  year: 2018,
  presentedAt: null,
  status: "sancionada",
  areas: ["tecnologia"],
  authors: [{ name: "Milton Monti", kind: "deputy", party: "PR", uf: "SP" }],
  parties: ["PR"],
  executive: { name: "Michel Temer", office: "Presidente", party: "MDB" },
  sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" }],
  signedAt: "2018-08-14",
};

test("law title adds the official reference once", () => {
  assert.equal(lawTitle(law), "Lei Geral de Proteção de Dados (LGPD): Lei 13.709/2018");
  assert.equal(lawTitle({ ...law, title: "Lei 13.709/2018" }), "Lei 13.709/2018");
  assert.equal(lawTitle({ ...law, number: undefined }), "Lei Geral de Proteção de Dados (LGPD): Lei de 2018");
});

test("law description fits a search snippet", () => {
  const d = lawDescription(law);
  assert.ok(d.startsWith(law.summary));
  assert.ok(d.length <= 158, d);
  assert.match(lawDescription({ ...law, level: "estadual", jurisdiction: "SP" }), /Lei estadual \(SP\)/);
  const long = lawDescription({ ...law, summary: "palavra ".repeat(60) });
  assert.ok(long.length <= 158 && long.endsWith("…"));
});

test("sitemap chunks are stable and bounded", () => {
  const items = ["c", "a", "b", "e", "d"].map((id) => ({ id }));
  assert.deepEqual(sitemapChunks(items, 2).map((c) => c.map((x) => x.id)), [["a", "b"], ["c", "d"], ["e"]]);
  assert.deepEqual(sitemapChunks([], 2), []);
});

test("sitemap XML uses absolute, escaped URLs", () => {
  const index = sitemapIndexXml(["/sitemaps/leis-1.xml"], "2026-10-31", "https://x.org");
  assert.match(index, /<sitemapindex[^>]*>[\s\S]*<loc>https:\/\/x\.org\/sitemaps\/leis-1\.xml<\/loc><lastmod>2026-10-31<\/lastmod>/);
  const set = urlsetXml([{ path: "/lei/a&b", lastmod: "2026-10-31", image: "/lei/a&b/opengraph-image" }], "https://x.org");
  assert.match(set, /<loc>https:\/\/x\.org\/lei\/a&amp;b<\/loc>/);
  assert.match(set, /<image:loc>https:\/\/x\.org\/lei\/a&amp;b\/opengraph-image<\/image:loc>/);
});

test("law JSON-LD is schema.org Legislation linked to the official text", () => {
  const ld = lawJsonLd(law, "https://x.org") as { "@graph": Record<string, unknown>[] };
  const [leg, crumbs] = ld["@graph"];
  assert.equal(leg["@type"], "Legislation");
  assert.equal(leg.url, "https://x.org/lei/federal-lei-13709-2018");
  assert.equal(leg.legislationIdentifier, "Lei 13.709/2018");
  assert.equal(leg.legislationDate, "2018-08-14");
  assert.equal(leg.legislationLegalForce, undefined);
  assert.equal((lawJsonLd({ ...law, status: "revogada" }, "https://x.org") as typeof ld)["@graph"][0].legislationLegalForce, "https://schema.org/NotInForce");
  assert.deepEqual(leg.sameAs, [law.sources[0].url]);
  assert.equal(crumbs["@type"], "BreadcrumbList");
  // No undefined keys left behind.
  assert.ok(Object.values(leg).every((v) => v !== undefined));
  // Executive-sent bills list no personal author.
  const exec = lawJsonLd({ ...law, authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }] }, "https://x.org") as typeof ld;
  assert.equal(exec["@graph"][0].author, undefined);
});

test("site JSON-LD declares the search box", () => {
  const ld = JSON.stringify(siteJsonLd("https://x.org"));
  assert.match(ld, /"urlTemplate":"https:\/\/x\.org\/\?q=\{search_term_string\}"/);
});

test("JSON-LD can't close its script tag", () => {
  assert.ok(!jsonLdString({ name: "</script><b>" }).includes("</script>"));
});
