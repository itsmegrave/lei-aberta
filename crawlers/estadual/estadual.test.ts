import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { validate } from "../lib/store.ts";
import { validateSource } from "../../lib/sources.ts";
import { alespToPolicy, detectRecordTag, parseNorma, parseTipos, splitAuthors } from "./alesp.ts";
import { PartyAtElection, csvLine, parseCandidates } from "./tse.ts";
import { bareNumber, lawType, shortTitle, tameCaps } from "./common.ts";
import { robotsAllows, robotsRules } from "./http.ts";
import { type AuthorBook, type Autor, type Filiacao, type Materia, type Norma, type TipoNorma, authorKind, partyOn, saplId, saplToPolicy, siglaFromStr, targetTypes } from "./sapl.ts";
import { STATES, byUf } from "./states.ts";
import { child, decodeXmlStream, forEachElement, zipTextChunks } from "./zip.ts";

const fx = (f: string) => path.join(import.meta.dirname, "fixtures", f);
const json = async <T>(f: string) => JSON.parse(await readFile(fx(f), "utf8")) as T;

/** Builds a one-entry deflate zip, like the Alesp dumps. */
function makeZip(name: string, content: Buffer): Buffer {
  const data = deflateRawSync(content);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + n.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + n.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, n, data, central, n, eocd]);
}

test("states: all 27 houses, unique UFs, official https urls", () => {
  assert.equal(STATES.length, 27);
  assert.equal(new Set(STATES.map((s) => s.uf)).size, 27);
  for (const s of STATES) assert.match(s.url, /^https:\/\/([a-z0-9-]+\.)*(gov|leg)\.br(\/|$)/, s.uf);
  for (const s of STATES.filter((x) => !x.adapter)) assert.ok(s.note, `${s.uf} needs a note`);
});

test("lawType maps house type names and LexML equivalents, ignores other acts", () => {
  assert.equal(lawType("Lei ordinária", "lei"), "lei");
  assert.equal(lawType("Lei Ordinária"), "lei");
  assert.equal(lawType("LEI"), "lei");
  assert.equal(lawType("Lei Complementar"), "lei-complementar");
  assert.equal(lawType("Emenda Constitucional", "ementa.constitucional"), "emenda-constitucional");
  assert.equal(lawType("Emenda à Constituição"), "emenda-constitucional");
  assert.equal(lawType("Decreto Legislativo", "decreto.legislativo"), null);
  assert.equal(lawType("Lei Delegada"), null);
  assert.equal(lawType("Resolução"), null);
});

test("helpers: numbers, caps, titles", () => {
  assert.equal(bareNumber("14.738"), "14738");
  assert.equal(bareNumber("1", "A"), "1-a");
  assert.equal(tameCaps("DISPÕE SOBRE O REGIME PRÓPRIO DE PREVIDÊNCIA."), "Dispõe sobre o regime próprio de previdência.");
  assert.equal(tameCaps("Dispõe sobre a Lei nº 1."), "Dispõe sobre a Lei nº 1.");
  assert.equal(shortTitle("Institui a semana X, e dá outras providências."), "Institui a semana X");
});

test("robots.txt: our group wins over *, longest match, Allow on ties", () => {
  const rules = robotsRules("User-agent: *\nDisallow: /api/\nAllow: /api/norma/\n\nUser-agent: OtherBot\nDisallow: /");
  assert.equal(robotsAllows(rules, "/api/materia/1/"), false);
  assert.equal(robotsAllows(rules, "/api/norma/normajuridica/?ano=2024"), true);
  assert.equal(robotsAllows(rules, "/norma/1"), true);
  const mine = robotsRules("User-agent: *\nDisallow: /\n\nUser-agent: LeiAbertaBot\nDisallow: /admin");
  assert.equal(robotsAllows(mine, "/api/x"), true);
  assert.equal(robotsAllows(robotsRules("User-agent: *\nDisallow: /*.pdf$"), "/a.pdf"), false);
  assert.equal(robotsAllows(robotsRules("User-agent: *\nDisallow:"), "/anything"), true);
});

async function saplBook(): Promise<AuthorBook> {
  const autores = await json<Autor[]>("sapl-autores.json");
  const filiacoes = await json<Filiacao[]>("sapl-filiacoes.json");
  const fil = new Map<number, Filiacao[]>();
  for (const f of filiacoes) fil.set(f.parlamentar, [...(fil.get(f.parlamentar) ?? []), f]);
  return {
    autores: new Map(autores.map((a) => [a.id, a])),
    tipos: new Map([[1, "Parlamentar"], [2, "Poder Executivo"]]),
    filiacoes: fil,
    // Partido 52 is missing on purpose: the acronym then comes from the affiliation's __str__.
    partidos: new Map([[7, "PSB"], [12, "PDT"]]),
  };
}

test("SAPL: picks law types per house, including the 'ementa.constitucional' typo", async () => {
  const types = targetTypes(await json<TipoNorma[]>("sapl-tipos.json"));
  assert.deepEqual([...types].sort((a, b) => a[0] - b[0]), [[1, "lei"], [2, "lei-complementar"], [3, "emenda-constitucional"], [9, "lei"]]);
});

test("SAPL: party is the affiliation on the presentation date, never today's", async () => {
  const book = await saplBook();
  assert.equal(partyOn(book, 5, "2020-01-01"), "PSB");
  assert.equal(partyOn(book, 5, "2023-05-10"), "REP");
  assert.equal(partyOn(book, 7, "2023-05-10"), null, "affiliation starts later: unknown, not current party");
  assert.equal(partyOn(book, 5, null), null);
  assert.equal(siglaFromStr("Fulano - PSB - Partido Socialista Brasileiro"), "PSB");
  assert.equal(authorKind("Poder Executivo"), "executive");
  assert.equal(authorKind("Parlamentar"), "state-deputy");
  assert.equal(authorKind(undefined, "Deputado"), "state-deputy");
  assert.equal(authorKind("Comissão"), "committee");
  // Seen live in AM, PI, TO: governor filed under a generic type, collective authorships, courts.
  assert.equal(authorKind("Órgão", null, "Poder Executivo"), "executive");
  assert.equal(authorKind("Poder Executivo Estadual", null, "WANDERLEI BARBOSA CASTRO"), "executive");
  assert.equal(authorKind("Governo do Estado do Piauí", null, "Rafael Tajra Fonteles"), "executive");
  assert.equal(authorKind("Parlamentares em Conjunto", "Deputado", "Coletiva"), "group");
  assert.equal(authorKind("Órgão", null, "Tribunal de Justiça"), "other-power");
  assert.equal(authorKind("Poder Executivo Municipal", null, "Prefeitura X"), "other");
  assert.equal(authorKind("Mesa Diretora", null, "Mesa Diretora"), "board");
});

test("SAPL: law to record", async () => {
  const book = await saplBook();
  const page = await json<{ results: Norma[] }>("sapl-normas.json");
  const materia = await json<Materia>("sapl-materia.json");
  const ro = byUf("RO")!;
  const p = saplToPolicy(ro, "lei", page.results[0], materia, materia.autores!, book);
  assert.equal(p.id, "estadual-ro-lei-5723-2024", "year comes from the law's date, not SAPL's 'ano'");
  assert.equal(saplId(ro, "lei", page.results[0]), p.id, "nightly runs skip known laws by this id before fetching the bill");
  assert.equal(p.level, "estadual");
  assert.equal(p.jurisdiction, "Rondônia");
  assert.equal(p.number, "5.723");
  assert.equal(p.presentedAt, "2023-05-10");
  assert.equal(p.title, "Altera o art. 1º da Lei nº 4.165, de 2019, que institui a Semana Estadual da Mãe Atípica");
  assert.deepEqual(p.authors, [
    { name: "Deputada Exemplo A", kind: "state-deputy", party: "REP", uf: "RO" },
    { name: "Governo do Estado", kind: "executive", party: null, uf: "RO" },
    { name: "Deputado Exemplo B", kind: "state-deputy", party: null, uf: "RO" },
  ]);
  assert.deepEqual(p.parties, ["REP"]);
  assert.equal(p.bill, "PL 123/2023");
  assert.equal(p.signedAt, "2024-01-04");
  assert.equal(p.executive, null, "governor's party is a separate field, filled from TSE data later");
  assert.deepEqual(p.sources.map((s) => s.url), [
    "https://sapl.al.ro.leg.br/norma/11912",
    "https://sapl.al.ro.leg.br/media/sapl/public/normajuridica/2023/11912/l5723.pdf",
  ]);
  assert.deepEqual(validate(p), []);

  const old = saplToPolicy(ro, "lei", page.results[1], null, [], book);
  assert.equal(old.id, "estadual-ro-lei-99-1993");
  assert.equal(old.summary, "Concede o título de cidadão do estado de rondônia ao ministro fulano de tal.");
  assert.deepEqual(old.authors, []);
  assert.deepEqual(validate(old), []);
});

test("zip + streaming XML: decodes ISO-8859-1 and finds rows split across chunks", async () => {
  const tiposBuf = await readFile(fx("alesp-tipos.xml"));
  let xml = "";
  for await (const c of decodeXmlStream([tiposBuf])) xml += c;
  const tipos = parseTipos(xml);
  assert.deepEqual([...tipos], [[1, "lei"], [2, "lei-complementar"], [4, "emenda-constitucional"]]);

  const zip = makeZip("legislacao_normas.xml", await readFile(fx("alesp-normas.xml")));
  const rows: string[] = [];
  await forEachElement(zipTextChunks(zip, ".xml"), "norma", (x) => rows.push(child(x, "idNorma")));
  assert.deepEqual(rows, ["190001", "190001", "190002", "12", "190003"]);

  async function* tiny() {
    const s = "<root><row><a>1</a></row><row><a>2</a></row></root>";
    for (let i = 0; i < s.length; i += 3) yield s.slice(i, i + 3);
  }
  const got: string[] = [];
  await forEachElement(tiny(), "row", (x) => got.push(child(x, "a")));
  assert.deepEqual(got, ["1", "2"]);
});

test("Alesp: detects row tags, filters types and years, maps status, authors and party at election", async () => {
  const normasXml = await readFile(fx("alesp-normas.xml"), "utf8");
  assert.equal(detectRecordTag(normasXml, "idNorma"), "norma");
  assert.equal(detectRecordTag("<a><DocumentoAutor><IdDocumento>1</IdDocumento></DocumentoAutor></a>", "IdDocumento"), "DocumentoAutor");
  assert.deepEqual(splitAuthors("Delegado Olim, Altair Moraes, Marcio Nakashima e outros"), ["Delegado Olim", "Altair Moraes", "Marcio Nakashima"]);
  assert.deepEqual(splitAuthors("Ana Paula e Eduardo Suplicy"), ["Ana Paula", "Eduardo Suplicy"]);
  assert.deepEqual(splitAuthors(""), []);

  const tipos = new Map([[9, "lei" as const], [2, "lei-complementar" as const]]);
  const rows = [...normasXml.matchAll(/<norma>([\s\S]*?)<\/norma>/g)].map((m) => parseNorma(m[1], tipos, { since: 1989, until: 2030 }));
  assert.equal(rows[2], null, "decrees are skipped");
  assert.equal(rows[3], null, "pre-1989 laws are skipped");
  const sp = byUf("SP")!;
  const lookups: [string, string | null][] = [];
  const partyAt = (name: string, date: string | null) => (lookups.push([name, date]), name === "Fulana de Tal" ? "PAA" : null);
  const lei = alespToPolicy(sp, rows[0]!, partyAt);
  assert.equal(lei.id, "estadual-sp-lei-17890-2024");
  assert.equal(lei.summary, "Institui a Semana Estadual de Conscientização sobre a Água & o Saneamento.");
  assert.equal(lei.status, "sancionada");
  assert.equal(lei.signedAt, "2024-03-15");
  assert.deepEqual(lei.sources, [{ label: "Alesp: ficha da norma", url: "https://www.al.sp.gov.br/norma/190001" }]);
  assert.deepEqual(lei.authors, [
    { name: "Fulana de Tal", kind: "state-deputy", party: "PAA", uf: "SP", partyBasis: "election" },
    { name: "Beltrano Souza", kind: "state-deputy", party: null, uf: "SP" },
  ]);
  assert.deepEqual(lei.parties, ["PAA"]);
  assert.deepEqual(lookups, [["Fulana de Tal", "2024-03-15"], ["Beltrano Souza", "2024-03-15"]]);
  assert.deepEqual(validate(lei), []);

  const lc = alespToPolicy(sp, rows[4]!, partyAt);
  assert.equal(lc.id, "estadual-sp-lei-complementar-1400-2024");
  assert.equal(lc.status, "promulgada");
  assert.equal(lc.title, "Dispõe sobre o regime próprio de previdência dos servidores públicos");
  assert.deepEqual(lc.authors, [{ name: "Governador do Estado", kind: "executive", party: null, uf: "SP" }]);
  assert.deepEqual(lc.sources[0].url, "https://www.al.sp.gov.br/norma/190003");
});

test("TSE: parses Latin-1 candidate CSVs and finds the party at the last election before the law", async () => {
  assert.deepEqual(csvLine('"a";"b ""c""";"";d'), ["a", 'b "c"', "", "d"]);
  const read = async (f: string, year: number) => parseCandidates(decodeXmlStream([await readFile(fx(f))]), "SP", year);
  const c2022 = await read("tse-2022.csv", 2022);
  assert.deepEqual(c2022.map((c) => [c.ballotName, c.party, c.elected, c.substitute]), [
    ["FULANA DE TAL", "PAA", true, false],
    ["BELTRANO SOUZA", "PBB", false, true],
    ["CICRANO", "PCC", false, false],
  ]);
  const t = new PartyAtElection([...(await read("tse-2018.csv", 2018)), ...c2022]);
  assert.deepEqual(t.partyFor("Fulana de Tal", "2024-03-15"), { party: "PAA", election: 2022 });
  assert.deepEqual(t.partyFor("Deputada Fulana de Tal", "2020-05-01"), { party: "POLD", election: 2018 }, "the 2018 term");
  assert.deepEqual(t.partyFor("FULANA DE TAL", "2023-01-20"), { party: "POLD", election: 2018 }, "2022 winners take office in 2023");
  assert.deepEqual(t.partyFor("Beltrano Souza", "2024-01-01"), { party: "PBB", election: 2022 }, "suplentes count");
  assert.equal(t.partyFor("Cicrano", "2024-01-01"), null, "not elected");
  assert.equal(t.partyFor("Mesmo Nome", "2020-01-01"), null, "two people, two parties: ambiguous");
  assert.equal(t.partyFor("Ninguém", "2020-01-01"), null);
  assert.equal(t.partyFor("Fulana de Tal", "2018-12-01"), null, "no earlier election on file");
});

test("source manifests in data/sources are valid for every house", async () => {
  for (const s of STATES) {
    const f = path.join(import.meta.dirname, "../../data/sources", `assembleia-${s.uf.toLowerCase()}.json`);
    const src = JSON.parse(await readFile(f, "utf8"));
    assert.deepEqual(validateSource(src, path.basename(f)), [], s.uf);
    assert.deepEqual(src.coverage, [s.uf]);
  }
});
