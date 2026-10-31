import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { actUrl, federalId, isCatalogued, leituraUrl, parseEmenta, parseHeader, parseLeitura, toRecord as douRecord } from "./dou.ts";
import { extractLaws, gazettesUrl, municipalId, toRecord as qdRecord, type Gazette } from "./querido-diario.ts";
import { bareNumber, dateRange, isoDate, shortTitle } from "./text.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("text helpers", () => {
  assert.equal(isoDate("5", "MARÇO", "2024"), "2024-03-05");
  assert.equal(isoDate("5", "foo", "2024"), null);
  assert.equal(bareNumber("14.973"), "14973");
  assert.equal(bareNumber("2.200-2"), "2200-2");
  assert.deepEqual(dateRange("2024-02-28", "2024-03-01"), ["2024-02-28", "2024-02-29", "2024-03-01"]);
  assert.equal(shortTitle("Institui o Programa de Hortas e dá outras providências."), "Institui o Programa de Hortas");
  assert.equal(
    shortTitle("Dispõe sobre a transição da cobrança; altera a Lei nº 12.546, de 14 de dezembro de 2011; e dá outras providências."),
    "Dispõe sobre a transição da cobrança",
  );
  assert.ok(shortTitle("a ".repeat(100)).length <= 91);
});

test("DOU: urls", () => {
  assert.equal(leituraUrl("2024-09-17", "do1"), "https://www.in.gov.br/leiturajornal?data=17-09-2024&secao=do1");
  assert.equal(actUrl("lei-n-1"), "https://www.in.gov.br/web/dou/-/lei-n-1");
});

test("DOU: headers of catalogued norms", () => {
  assert.deepEqual(parseHeader("LEI Nº 14.973, DE 16 DE SETEMBRO DE 2024"), { type: "lei", number: "14.973", date: "2024-09-16" });
  assert.deepEqual(parseHeader("LEI COMPLEMENTAR Nº 208, DE 2 DE JULHO DE 2024")?.type, "lei-complementar");
  assert.deepEqual(parseHeader("MEDIDA PROVISÓRIA Nº 2.200-2, DE 24 DE AGOSTO DE 2001"), { type: "mp", number: "2.200-2", date: "2001-08-24" });
  assert.equal(parseHeader("EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023")?.type, "emenda-constitucional");
  assert.equal(parseHeader("LEI Nº 14.000, DE 1º DE JANEIRO DE 2020")?.date, "2020-01-01");
  assert.equal(parseHeader("DECRETO Nº 12.180, DE 16 DE SETEMBRO DE 2024"), null);
  assert.equal(parseHeader("PORTARIA Nº 1, DE 16 DE SETEMBRO DE 2024"), null);
});

test("DOU: table of contents keeps laws, LCs and MPs only", () => {
  const items = parseLeitura(fixture("leiturajornal-do1.html"));
  assert.equal(items.length, 6);
  const kept = items.filter((i) => isCatalogued(i));
  assert.deepEqual(kept.map((i) => isCatalogued(i)!.type), ["lei", "mp", "lei-complementar"]);
  assert.deepEqual(parseLeitura("<html>no params</html>"), []);
});

test("DOU: ementa and record", () => {
  const ementa = parseEmenta(fixture("dou-act.html"))!;
  assert.match(ementa, /^Dispõe sobre a transição/);
  const [lei, mp, lc] = parseLeitura(fixture("leiturajornal-do1.html")).filter((i) => isCatalogued(i));

  const r = douRecord(lei, isCatalogued(lei)!, ementa, "2024-09-17", "do1");
  assert.equal(r.id, "federal-lei-14973-2024");
  assert.equal(r.status, "sancionada");
  assert.deepEqual(r.authors, []);
  assert.equal(r.executive, null);
  assert.equal(r.sources[0].label, "Diário Oficial da União, 17/09/2024, Seção 1, p. 1");
  assert.match(r.sources[0].url, /^https:\/\/www\.in\.gov\.br\/web\/dou\/-\/lei-n-14\.973/);

  const m = douRecord(mp, isCatalogued(mp)!, "Abre crédito extraordinário.", "2024-09-17", "do1e");
  assert.equal(m.id, "federal-mp-1255-2024");
  assert.equal(m.status, "em-tramitacao");
  assert.equal(m.presentedAt, "2024-09-16");
  assert.equal(m.authors[0].kind, "executive");
  assert.equal(m.parties.length, 0, "the executive never counts as an author party");
  assert.match(m.sources[0].label, /edição extra/);

  assert.equal(federalId(isCatalogued(lc)!), "federal-lc-208-2024");
});

test("Querido Diário: law headings and ementas", () => {
  const laws = extractLaws(fixture("gazette.txt"), 2023);
  assert.deepEqual(
    laws.map((l) => [l.type, l.number, l.date]),
    [["lei", "18.123", "2024-10-10"], ["lei-complementar", "45", "2024-10-11"], ["lei", "7.693", "2024-10-22"]],
  );
  assert.equal(laws[0].ementa, "Institui o Programa Municipal de Hortas Comunitárias e dá outras providências.");
  assert.equal(laws[1].ementa, "Altera o Código Tributário Municipal para conceder isenção de IPTU a imóveis tombados.");
  assert.equal(extractLaws("a Lei nº 8.080, de 19 de setembro de 1990, diz", 1980).length, 0, "lowercase citations are not headings");
});

test("Querido Diário: record", () => {
  const g: Gazette = {
    territory_id: "3550308", territory_name: "São Paulo", state_code: "SP", date: "2024-10-12",
    edition: "190", is_extra_edition: false, url: "https://data.queridodiario.ok.org.br/3550308/2024-10-12/abc.pdf",
    txt_url: "https://data.queridodiario.ok.org.br/3550308/2024-10-12/abc.txt",
  };
  const [law] = extractLaws(fixture("gazette.txt"), 2023);
  const r = qdRecord(g, law);
  assert.equal(r.id, "municipal-3550308-lei-18123-2024");
  assert.equal(r.jurisdiction, "São Paulo (SP)");
  assert.equal(r.title, "Institui o Programa Municipal de Hortas Comunitárias");
  assert.equal(r.sources[0].label, "Diário Oficial de São Paulo nº 190, 12/10/2024");
  assert.equal(r.executive, null);
  assert.equal(municipalId("1", { type: "lei-complementar", number: "45", date: "2024-01-01" }), "municipal-1-lc-45-2024");
  assert.equal(
    gazettesUrl(["1", "2"], "2024-01-01", "2024-01-02", 0),
    "https://queridodiario.ok.org.br/api/gazettes?published_since=2024-01-01&published_until=2024-01-02&offset=0&size=100&sort_by=ascending_date&territory_ids=1&territory_ids=2",
  );
});

test("store: DOU only adds its source to a record the federal crawler owns", async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { openStore } = await import("../lib/store.ts");
  const dir = await mkdtemp(path.join(tmpdir(), "diarios-"));
  const store = await openStore(dir);
  const [lei] = parseLeitura(fixture("leiturajornal-do1.html")).filter((i) => isCatalogued(i));
  const federal = {
    ...douRecord(lei, isCatalogued(lei)!, "Ementa", "2024-09-17", "do1"),
    title: "Desoneração da folha",
    authors: [{ name: "Fulano", kind: "senator", party: "PSD", uf: "MG" }],
    parties: ["PSD"],
    executive: { name: "Luiz Inácio Lula da Silva", office: "Presidente", party: "PT" },
    sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14973.htm" }],
  };
  store.upsert(federal, { owner: true });
  const dou = douRecord(lei, isCatalogued(lei)!, parseEmenta(fixture("dou-act.html"))!, "2024-09-17", "do1");
  const merged = store.upsert(dou, { owner: false, preserve: ["title", "summary", "areas"] });
  assert.equal(merged.title, "Desoneração da folha");
  assert.deepEqual(merged.parties, ["PSD"]);
  assert.equal(merged.executive?.party, "PT");
  assert.deepEqual(merged.sources.map((s) => s.label), ["Planalto", "Diário Oficial da União, 17/09/2024, Seção 1, p. 1"]);

  const g: Gazette = { territory_id: "3550308", territory_name: "São Paulo", state_code: "SP", date: "2024-10-12", url: "https://data.queridodiario.ok.org.br/x.pdf" };
  const [law] = extractLaws(fixture("gazette.txt"), 2023);
  assert.throws(() => store.upsert(qdRecord(g, law), { owner: true }), /official/, "a Querido Diário copy alone is not an official source");
  store.upsert(qdRecord(g, law, { label: "Prefeitura", url: "https://diariooficial.prefeitura.sp.gov.br" }), { owner: true });
  await store.save();
  const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  assert.deepEqual(index.files.map((f: { path: string }) => f.path), ["federal/2024.json", "municipal/2024.json"]);
});

test("INLABS: article XML to record", async () => {
  const { parseArticle, articleToRecord } = await import("./inlabs.ts");
  const a = parseArticle(fixture("inlabs-article.xml"))!;
  assert.equal(a.identifica, "LEI Nº 14.973, DE 16 DE SETEMBRO DE 2024");
  const r = articleToRecord(a, "do1", "2024-09-17")!;
  assert.equal(r.id, "federal-lei-14973-2024");
  assert.match(r.title, /^Dispõe sobre a transição da cobrança/);
  assert.equal(r.sources[0].url, "https://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp?data=17/09/2024&jornal=515&pagina=1");
  assert.equal(r.sources[0].label, "Diário Oficial da União, 17/09/2024, Seção 1, p. 1");
  assert.equal(articleToRecord({ ...a, identifica: "PORTARIA Nº 1, DE 1 DE JANEIRO DE 2024" }, "do1", "2024-01-02"), null);
});

test("http: browser user agent is only a fallback", async () => {
  const { HttpError, looksBlocked, userAgentFor, USER_AGENT } = await import("./http.ts");
  assert.equal(userAgentFor("https://www.in.gov.br/leiturajornal"), USER_AGENT, "our own user agent goes first");
  assert.ok(looksBlocked(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })));
  assert.ok(looksBlocked(new HttpError(403, "x")));
  assert.ok(!looksBlocked(new HttpError(404, "x")), "a missing page is not a block");
  assert.ok(!looksBlocked(new HttpError(503, "x")));
  assert.ok(!looksBlocked(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" })));
});
