import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../lib/store.ts";
import { validateSource, type DataSource } from "../../lib/sources.ts";
import type { AuthorBook, Norma } from "../estadual/sapl.ts";
import { CAPITALS } from "../diarios/querido-diario.ts";
import { municipalId as qdId } from "../diarios/querido-diario.ts";
import { CITIES, findCity, sourceId } from "./cities.ts";
import { type LeiAprovada, type Promovente, type Vereador, cmspKind, cmspPartyOn, cmspToPolicy, joinLaws } from "./cmsp.ts";
import { municipalLawType, normalizeParty, tidyEmenta, titleCase } from "./common.ts";
import { MayorTable, mayorName, parseMayors } from "./mayors.ts";
import { municipalAuthorKind, saplId, saplToPolicy, targetTypes } from "./sapl.ts";

const city = (k: string) => findCity(k)!;

test("cities: the 26 capitals, same IBGE codes as the Diários crawler, official https urls", () => {
  assert.equal(CITIES.length, 26);
  assert.deepEqual(new Set(CITIES.map((c) => c.ibge)), new Set(Object.keys(CAPITALS)));
  for (const c of CITIES) assert.match(c.url, /^https:\/\/([a-z0-9-]+\.)*((gov|leg)\.br|camara\.rio)(\/|$)/, c.name);
  for (const c of CITIES.filter((x) => !x.adapter)) assert.ok(c.note, `${c.name} needs a note`);
  assert.equal(new Set(CITIES.map(sourceId)).size, 26);
  assert.equal(sourceId(city("João Pessoa")), "camara-municipal-joao-pessoa");
  assert.equal(findCity("2304400")?.name, "Fortaleza");
  assert.equal(findCity("pb")?.name, "João Pessoa");
  assert.equal(findCity("sao paulo")?.ibge, "3550308");
});

test("municipalLawType keeps leis and leis complementares by name, ignores LexML and other acts", () => {
  assert.equal(municipalLawType("Lei Ordinária"), "lei");
  assert.equal(municipalLawType("LEI ORDINÁRIA"), "lei");
  assert.equal(municipalLawType("Lei Promulgada"), "lei");
  assert.equal(municipalLawType("Lei de Diretrizes Orçamentárias"), "lei");
  assert.equal(municipalLawType("Lei Complementar Promulgada"), "lei-complementar");
  assert.equal(municipalLawType("LEI COMPLEMENTAR"), "lei-complementar");
  assert.equal(municipalLawType("Lei Orgânica do Município de Boa Vista"), null);
  assert.equal(municipalLawType("Emenda à Lei Orgânica"), null);
  assert.equal(municipalLawType("Resolução"), null); // João Pessoa files it with LexML "lei"
  assert.equal(municipalLawType("Decreto Legislativo"), null);
  const types = targetTypes([
    { id: 1, descricao: "Lei" },
    { id: 5, descricao: "Resolução", equivalente_lexml: "lei" },
    { id: 2, descricao: "Lei Complementar" },
  ]);
  assert.deepEqual([...types], [[1, "lei"], [2, "lei-complementar"]]);
});

test("ids match the Diários Oficiais crawler, so a law found in both is one record", () => {
  const n = { id: 9, numero: "11.701", ano: 2026, data: "2026-10-08", ementa: "x", tipo: 1, materia: null } as Norma;
  assert.equal(saplId(city("Fortaleza"), "lei", n), "municipal-2304400-lei-11701-2026");
  assert.equal(qdId("2304400", { type: "lei", number: "11.701", date: "2026-10-08" }), "municipal-2304400-lei-11701-2026");
  assert.equal(saplId(city("Fortaleza"), "lei-complementar", { ...n, numero: "470" }), "municipal-2304400-lc-470-2026");
});

test("author kinds: vereador, prefeito filed in different ways, groups", () => {
  assert.equal(municipalAuthorKind("Parlamentar", null, "Ronaldo Martins"), "councilor");
  assert.equal(municipalAuthorKind("Chefe do Poder Executivo", "Prefeito", "Chefe do Executivo"), "executive");
  assert.equal(municipalAuthorKind("Externo", "Prefeito em Exercício", "Acrísio Sena (Prefeito em Exercício)"), "executive");
  assert.equal(municipalAuthorKind("Executivo Municipal", null, "Executivo Municipal"), "executive");
  assert.equal(municipalAuthorKind("Mesa Diretora", null, "Mesa Diretora"), "board");
  assert.equal(municipalAuthorKind("Comissao", null, "CCJ"), "committee");
  assert.equal(municipalAuthorKind("Bancada", null, "Bancada do PT"), "group");
  assert.equal(municipalAuthorKind("Vereadores", null, "Vereadores"), "group");
});

test("party spellings: one name per party, renamed back to the name in use on the date", () => {
  assert.equal(normalizeParty("REPUB", "2026-01-01"), "Republicanos");
  assert.equal(normalizeParty("REP", "2015-05-01"), "PRB");
  assert.equal(normalizeParty("UNIÃO BRASIL", "2024-01-01"), "UNIÃO");
  assert.equal(normalizeParty("UNIAO", "2024-01-01"), "UNIÃO");
  assert.equal(normalizeParty("MDB", "2010-01-01"), "PMDB");
  assert.equal(normalizeParty("PC do B", "1996-10-01"), "PCdoB");
  assert.equal(normalizeParty("PODEMOS", "2020-01-01"), "PODE");
  assert.equal(normalizeParty("Sem Partido", "2020-01-01"), null);
  assert.equal(normalizeParty("SEMPARTID", "2020-01-01"), null);
  assert.equal(normalizeParty("PSOL", "2020-01-01"), "PSOL");
});

const book: AuthorBook = {
  autores: new Map([
    [10, { id: 10, nome: "Ronaldo Martins", tipo: 1, object_id: 77 }],
    [11, { id: 11, nome: "Evandro Sá Barreto Leitão", tipo: 9, cargo: "Prefeito" }],
    [12, { id: 12, nome: "CAPITÃO CARPÊ", tipo: 1, object_id: 78 }],
  ]),
  tipos: new Map([
    [1, "Parlamentar"],
    [9, "Executivo"],
  ]),
  filiacoes: new Map([
    [77, [{ parlamentar: 77, partido: 1, data: "2017-01-01", data_desfiliacao: "2022-03-31" }, { parlamentar: 77, partido: 2, data: "2022-04-01", data_desfiliacao: null }]],
    [78, [{ parlamentar: 78, partido: 3, data: "2024-01-01", data_desfiliacao: null }]],
  ]),
  partidos: new Map([
    [1, "PDT"],
    [2, "REP"],
    [3, "PL"],
  ]),
};

test("SAPL law: authors with party on the bill's date, executive author without party, official links", () => {
  const n: Norma = {
    id: 14511, numero: "11701", ano: 2026, data: "2026-10-08", ementa: "\"Institui medidas punitivas à exploração do turismo sexual no Município de Fortaleza.\"", tipo: 1, materia: 70009,
    texto_integral: "http://sapl.fortaleza.ce.leg.br/media/sapl/public/normajuridica/2026/14511/lei.pdf",
  };
  const r = saplToPolicy(city("Fortaleza"), "lei", n, { id: 70009, __str__: "PLO 639/2021", data_apresentacao: "2021-06-01" }, [10, 11, 12], book);
  assert.equal(r.id, "municipal-2304400-lei-11701-2026");
  assert.equal(r.level, "municipal");
  assert.equal(r.jurisdiction, "Fortaleza (CE)");
  assert.equal(r.number, "11.701");
  assert.equal(r.title, "Institui medidas punitivas à exploração do turismo sexual no Município de Fortaleza");
  assert.deepEqual(r.authors, [
    { name: "Ronaldo Martins", kind: "councilor", party: "PDT", uf: "CE" }, // PDT in 2021, before he moved
    { name: "Evandro Sá Barreto Leitão", kind: "executive", party: null, uf: "CE" },
    { name: "Capitão Carpê", kind: "councilor", party: null, uf: "CE" }, // no affiliation covering 2021
  ]);
  assert.deepEqual(r.parties, ["PDT"]);
  assert.equal(r.executive, null);
  assert.equal(r.presentedAt, "2021-06-01");
  assert.equal(r.bill, "PLO 639/2021");
  assert.equal(r.sources[0].url, "https://sapl.fortaleza.ce.leg.br/norma/14511");
  assert.match(r.sources[1].url, /^https:\/\/sapl\.fortaleza/);
  assert.deepEqual(validate(r), []);
});

test("São Paulo: co-authored laws are joined, parties come from the câmara's affiliation history", () => {
  const sp = city("São Paulo");
  const vereador: Promovente = { chave: 1990, nome: "RICARDO NUNES", tipo: { chave: 1, nome: "VEREADOR" } };
  const other: Promovente = { chave: 221, nome: "GILBERTO KASSAB", tipo: { chave: 1, nome: "VEREADOR" } };
  const mayor: Promovente = { chave: 2229, nome: "RICARDO NUNES", tipo: { chave: 2, nome: "EXECUTIVO" } };
  const law = (n: number, pl: number, ano: number, pub: string, tipo = "PL"): LeiAprovada => ({
    projeto: { tipo, numero: pl, ano, ementa: "DISPÕE SOBRE A CRIAÇÃO DE ESTACIONAMENTO DE BICICLETAS E DÁ OUTRAS PROVIDÊNCIAS" },
    numero: n,
    publicacao: `${pub}T00:00:00`,
  });
  const joined = joinLaws([
    { p: vereador, laws: [law(17588, 100, 2019, "2021-05-02"), law(9, 1, 2020, "2020-02-02", "PLO")] },
    { p: other, laws: [law(17588, 100, 2019, "2021-05-02")] },
    { p: mayor, laws: [law(18270, 5, 2025, "2025-04-10")] },
  ]);
  assert.equal(joined.length, 2); // the PLO (Lei Orgânica amendment) is out of scope
  const vereadores = new Map<number, Vereador>([
    [1990, { chave: 1990, nome: "RICARDO NUNES", filiacoes: [{ inicio: "2011-01-01T00:00:00", partido: { sigla: "MDB" } }] }],
    [221, { chave: 221, nome: "GILBERTO KASSAB", filiacoes: [{ inicio: "1990-01-01T00:00:00", fim: "2000-01-01T00:00:00", partido: { sigla: "PL" } }] }],
  ]);
  const r = cmspToPolicy(sp, joined[0], vereadores);
  assert.equal(r.id, "municipal-3550308-lei-17588-2021");
  assert.equal(r.bill, "PL 100/2019");
  assert.deepEqual(r.authors, [
    { name: "Ricardo Nunes", kind: "councilor", party: "MDB", uf: "SP" },
    { name: "Gilberto Kassab", kind: "councilor", party: null, uf: "SP" },
  ]);
  assert.equal(r.title, "Dispõe sobre a criação de estacionamento de bicicletas");
  assert.match(r.sources[0].url, /^https:\/\/splegisconsulta\.saopaulo\.sp\.leg\.br\/.*ANO_PCSS_CMSP=2019&COD_PCSS_CMSP=100/);
  assert.deepEqual(validate(r), []);
  const m = cmspToPolicy(sp, joined[1], vereadores);
  assert.deepEqual(m.authors, [{ name: "Ricardo Nunes", kind: "executive", party: null, uf: "SP" }]);
  assert.equal(cmspKind("COMISSAO PERMANENTE"), "committee");
  assert.equal(cmspPartyOn(vereadores.get(1990), "2010-01-01"), null);
  assert.equal(titleCase("PROF.ª JACQUELINE DA SILVA"), "Prof.ª Jacqueline da Silva");
});

async function* chunks(s: string) {
  yield s;
}

test("mayors: elected prefeito per capital and term, party kept apart, never from authors", async () => {
  const header = '"ANO_ELEICAO";"NM_TIPO_ELEICAO";"NR_TURNO";"SG_UF";"NM_UE";"DS_CARGO";"NM_CANDIDATO";"NM_URNA_CANDIDATO";"SG_PARTIDO";"DS_SIT_TOT_TURNO"';
  const csv = [
    header,
    '2024;"ELEIÇÃO ORDINÁRIA";1;"CE";"FORTALEZA";"PREFEITO";"EVANDRO SA BARRETO LEITAO";"EVANDRO LEITÃO";"PT";"2º TURNO"',
    '2024;"ELEIÇÃO ORDINÁRIA";2;"CE";"FORTALEZA";"PREFEITO";"EVANDRO SA BARRETO LEITAO";"EVANDRO LEITÃO";"PT";"ELEITO"',
    '2024;"ELEIÇÃO ORDINÁRIA";2;"CE";"FORTALEZA";"PREFEITO";"ANDRE FERNANDES DE MOURA";"ANDRÉ FERNANDES";"PL";"NÃO ELEITO"',
    '2024;"ELEIÇÃO ORDINÁRIA";1;"CE";"FORTALEZA";"VEREADOR";"FULANO";"FULANO";"PSD";"ELEITO"',
    '2024;"ELEIÇÃO ORDINÁRIA";1;"CE";"CAUCAIA";"PREFEITO";"BELTRANO";"BELTRANO";"PSD";"ELEITO"',
  ].join("\r\n");
  const rows = await parseMayors(chunks(csv), CITIES.filter((c) => c.uf === "CE"), 2024);
  assert.deepEqual(rows, [{ election: 2024, ibge: "2304400", name: "Evandro Leitão", party: "PT" }]);
  const table = new MayorTable([...rows, { election: 2020, ibge: "2304400", name: "José Sarto", party: "PDT" }]);
  assert.deepEqual(table.at("2304400", 2025), { name: "Evandro Leitão", office: "Prefeito(a)", party: "PT", basis: "election", election: 2024 });
  assert.equal(table.at("2304400", 2024)?.name, "José Sarto"); // the 2024 winner takes office in January 2025
  assert.equal(table.at("2304400", 2020), null); // 2016 not loaded
  assert.equal(mayorName("LÉO", "LEONARDO BARRETO DE MORAES"), "Leonardo Barreto de Moraes");
  assert.equal(mayorName("EVANDRO LEITÃO", "EVANDRO SA BARRETO LEITAO"), "Evandro Leitão");
});

test("planned câmaras still produce valid manifests", () => {
  for (const c of CITIES) {
    const s: DataSource = {
      id: sourceId(c), name: c.house, publisher: c.house, url: c.url, levels: ["municipal"], coverage: [c.name],
      covers: ["lei municipal"], description: c.note ?? "x", status: c.adapter ? "building" : "planned",
    };
    assert.deepEqual(validateSource(s, `${sourceId(c)}.json`), [], c.name);
  }
});

test("ementas lose wrapping quotes and a repeated law heading", () => {
  assert.equal(tidyEmenta('LEI COMPLEMENTAR N° 364 DE 19 DE MAIO DE 2026 "Institui o projeto BEM."'), "Institui o projeto BEM.");
  assert.equal(tidyEmenta('"Declara de utilidade pública a Associação X."'), "Declara de utilidade pública a Associação X.");
  assert.equal(tidyEmenta("Altera a Lei nº 3.882, de 11 de dezembro de 1989"), "Altera a Lei nº 3.882, de 11 de dezembro de 1989");
});
