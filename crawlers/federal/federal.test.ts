// Fixtures below are trimmed copies of real Senado/Câmara API responses (October 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApis, deputyAt } from "./apis.ts";
import { lawRecord, mpRecord, mpStatus, parseIdent, parseNormaGerada, pickProcess, resolveAuthorship } from "./build.ts";
import { legislatureAt, partyNameAt, presidentAt } from "./politics.ts";
import { cleanEmenta, guessAreas, nickname } from "./text.ts";
import { validate } from "../lib/store.ts";

const S = "https://legis.senado.leg.br/dadosabertos";
const C = "https://dadosabertos.camara.leg.br/api/v2";
const FIXTURES: Record<string, unknown> = {
  // Lei 10.741/2003 (Estatuto da Pessoa Idosa): Câmara bill PL 3561/1997 by Paulo Paim.
  [`${S}/processo/2996233`]: {
    id: 2996233, identificacao: "PLC 57/2003", siglaCasaIniciadora: "CD", identificacaoProcessoInicial: "PL 3561/1997",
    autoriaIniciativa: [{ autor: "PAULO PAIM", siglaTipo: "DEPUTADO", descricaoTipo: "DEPUTADO", ente: "Câmara dos Deputados" }],
    documento: { autoria: [{ autor: "Câmara dos Deputados", siglaTipo: "CAMARA" }] },
  },
  [`${C}/proposicoes?siglaTipo=PL&numero=3561&ano=1997&itens=5`]: { dados: [{ id: 19849 }] },
  [`${C}/proposicoes/19849`]: { dados: { dataApresentacao: "1997-08-28T00:00" } },
  [`${C}/proposicoes/19849/autores`]: { dados: [{ uri: `${C}/deputados/73910`, nome: "Paulo Paim", codTipo: 10000, tipo: "Deputado(a)", ordemAssinatura: 1, proponente: 1 }] },
  [`${C}/deputados/73910/historico`]: {
    dados: [48, 49, 50, 51].map((l) => ({ dataHora: "2023-02-01T00:00", siglaPartido: "PT", siglaUf: "RS", idLegislatura: l })),
  },
  // Lei 8.069/1990 (ECA): PLS 193/1989 by senator Ronan Tito; the Senado labels his party "MDB" (today's name).
  [`${S}/processo/753867`]: {
    id: 753867, identificacao: "PLS 193/1989", siglaCasaIniciadora: "SF", identificacaoProcessoInicial: "PLS 193/1989",
    autoriaIniciativa: [{ autor: "Ronan Tito", siglaTipo: "SENADOR", descricaoTipo: "SENADOR", codigoParlamentar: 2224, siglaPartido: "MDB" }],
  },
  [`${S}/senador/2224/filiacoes.json`]: {
    FiliacaoParlamentar: { Parlamentar: { Codigo: "2224", Filiacoes: { Filiacao: [{ Partido: { SiglaPartido: "MDB" }, DataFiliacao: "1987-02-01" }] } } },
  },
  [`${S}/senador/2224.json`]: { DetalheParlamentar: { Parlamentar: { IdentificacaoParlamentar: {} } } }, // live API has no UF for him
  // Lei 14.116/2020 (LDO 2021): PLN 9/2020 by the Presidency.
  [`${S}/processo/7900029`]: { id: 7900029, identificacao: "PLN 9/2020", autoriaIniciativa: [{ autor: "Presidência da República", ente: "Presidência da República" }] },
};
const apis = makeApis(async (url) => {
  if (!(url in FIXTURES)) throw new Error(`unexpected fetch ${url}`);
  return FIXTURES[url];
});

test("Câmara bill: deputy author with party in the legislature of presentation", async () => {
  const proc = pickProcess([
    { id: 3362950, identificacao: "VET 31/2003", tipoDocumento: "Mensagem", dataApresentacao: "2003-10-03", normaGerada: "Lei nº 10.741 de 01/10/2003" },
    { id: 2996233, codigoMateria: 60770, identificacao: "PLC 57/2003", autoria: "Câmara dos Deputados", dataApresentacao: "2003-08-25", normaGerada: "Lei nº 10.741 de 01/10/2003" },
  ])!;
  assert.equal(proc.id, 2996233);
  const auth = await resolveAuthorship(apis, proc);
  assert.deepEqual(auth.authors, [{ name: "Paulo Paim", kind: "deputy", party: "PT", uf: "RS" }]);
  assert.equal(auth.presentedAt, "1997-08-28");
  assert.equal(auth.bill, "PL 3561/1997");
  const rec = lawRecord("LEI", { id: "1", tipo: "LEI-n", numero: "10741", norma: "LEI-10741-2003-10-01", normaNome: "", ementa: "Dispõe sobre o Estatuto do Idoso e dá outras providências.", dataassinatura: "01/10/2003", apelido: "LEI-10741-2003-10-01 , Estatuto do Idoso" }, auth);
  assert.equal(rec.id, "federal-lei-10741-2003");
  assert.equal(rec.title, "Estatuto do Idoso");
  assert.deepEqual(rec.parties, ["PT"]);
  assert.deepEqual(rec.executive, { name: "Luiz Inácio Lula da Silva", office: "Presidente", party: "PT" });
  assert.deepEqual(rec.sources.map((s) => s.url), [
    "https://normas.leg.br/?urn=urn:lex:br:federal:lei:2003-10-01;10741",
    "https://www25.senado.leg.br/web/atividade/materias/-/materia/60770",
    "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=19849",
  ]);
  assert.deepEqual(validate(rec), []);
});

test("Senate bill: senator's party mapped back to the name in use at the time", async () => {
  const auth = await resolveAuthorship(apis, { id: 753867, codigoMateria: 29333, identificacao: "PLS 193/1989", autoria: "Senador Ronan Tito (MDB/MG)", dataApresentacao: "1989-06-30" });
  assert.deepEqual(auth.authors, [{ name: "Ronan Tito", kind: "senator", party: "PMDB", uf: "MG" }]);
  const rec = lawRecord("LEI", { id: "2", tipo: "LEI-n", numero: "8069", norma: "LEI-8069-1990-07-13", normaNome: "", ementa: "DISPÕE SOBRE O ESTATUTO DA CRIANÇA E DO ADOLESCENTE, E DA OUTRAS      \nPROVIDENCIAS.  ", dataassinatura: "13/07/1990", apelido: "LEI-8069-1990-07-13 , ESTATUTO DA CRIANÇA E DO ADOLESCENTE / ECA" }, auth);
  assert.equal(rec.title, "Estatuto da Criança e do Adolescente / ECA");
  assert.equal(rec.summary, "Dispõe sobre o estatuto da criança e do adolescente, e da outras providencias.");
  assert.equal(cleanEmenta("Dispõe sobre o ESTATUTO DA CRIANÇA E DO ADOLESCENTE, e dá outras providências."), "Dispõe sobre o estatuto da criança e do adolescente, e dá outras providências.");
  assert.equal(cleanEmenta("Altera a legislação da COFINS e do PIS/PASEP."), "Altera a legislação da COFINS e do PIS/PASEP.");
  assert.deepEqual(rec.executive, { name: "Fernando Collor", office: "Presidente", party: "PRN" });
  assert.ok(rec.areas.includes("direitos-humanos"));
});

test("executive bill: author is the executive, with no party; president's party stays separate", async () => {
  const auth = await resolveAuthorship(apis, { id: 7900029, codigoMateria: 141576, identificacao: "PLN 9/2020", autoria: "Presidência da República", dataApresentacao: "2020-04-15" });
  assert.deepEqual(auth.authors, [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }]);
  const rec = lawRecord("LEI", { id: "3", tipo: "LEI-n", numero: "14116", norma: "LEI-14116-2020-12-31", normaNome: "", ementa: "Dispõe sobre as diretrizes para a elaboração e a execução da Lei Orçamentária de 2021 e dá outras providências.", dataassinatura: "31/12/2020", apelido: "LEI-14116-2020-12-31 , Lei de Diretrizes Orçamentárias - LDO (2021)" }, auth);
  assert.deepEqual(rec.parties, []);
  assert.equal(rec.executive?.party, null); // Bolsonaro had no party between Nov 2019 and Nov 2021
  assert.ok(rec.areas.includes("administracao-publica"));
});

test("MPs: reissues collapse into one record; status from the Senado process", () => {
  const eds = [10, 11].map((r) => ({ id: String(r), tipo: "MPV-ss", numero: "1858", reedicao: String(r), norma: `MPV-1858-${r}-1999`, normaNome: "", ementa: "Altera a legislação tributária federal.", dataassinatura: r === 10 ? "26/10/1999" : "25/11/1999" }));
  const first = { id: "0", tipo: "MPV-ss", numero: "1858", norma: "MPV-1858-1999-06-29", normaNome: "", ementa: "Altera a legislação tributária federal.", dataassinatura: "29/06/1999" };
  const rec = mpRecord([...eds, first], { id: 1, identificacao: "MPV 1858-11/1999", situacaoAtual: "SEM EFICÁCIA", tramitando: "Não" });
  assert.equal(rec.id, "federal-mp-1858-1999");
  assert.equal(rec.signedAt, "1999-06-29");
  assert.equal(rec.reissues, 2);
  assert.equal(rec.status, "perdeu-eficacia");
  assert.equal(rec.executive?.name, "Fernando Henrique Cardoso");
  assert.equal(rec.sources[1].url, "https://normas.leg.br/?urn=urn:lex:br:federal:medida.provisoria:1999-11-25;1858-11");
  assert.ok(rec.areas.includes("economia"));

  const conv = mpRecord([{ id: "9", tipo: "MPV-ss", numero: "918", norma: "MPV-918-2020-01-02", normaNome: "", ementa: "Institui funções de confiança.", dataassinatura: "02/01/2020" }],
    { id: 7859496, codigoMateria: 140394, identificacao: "MPV 918/2020", situacaoAtual: "TRANSFORMADA EM NORMA JURÍDICA", tramitando: "Não", normaGerada: "Lei nº 14.003 de 26/05/2020" });
  assert.equal(conv.status, "convertida");
  assert.equal(conv.convertedInto, "federal-lei-14003-2020");
  assert.deepEqual(conv.authors.map((a) => a.kind), ["executive"]);
  assert.equal(conv.executive?.party, null); // Bolsonaro left the PSL in Nov 2019
  assert.deepEqual(validate(conv), []);
  assert.equal(mpStatus({ id: 1, identificacao: "MPV 1/2026", tramitando: "Sim" }), "em-tramitacao");
});

test("parsers and helpers", () => {
  assert.deepEqual(parseNormaGerada("Lei Complementar nº 101 de 04/05/2000"), { kind: "Lei Complementar", numero: "101", date: "2000-05-04" });
  assert.deepEqual(parseIdent("MPV 1731-34/1999"), { sigla: "MPV", numero: 1731, reissue: 34, ano: 1999 });
  assert.equal(nickname("LEI-14115-2020-12-29", "LEI-14115-2020-12-29"), null);
  assert.equal(nickname("LEI-10741-2003-10-01 , Lei do Idoso (2003), Estatuto da Pessoa Idosa (2003), Estatuto do Idoso (2003)", "LEI-10741-2003-10-01", 2003), "Estatuto da Pessoa Idosa");
  assert.equal(nickname("LEI-8069-1990-07-13 , Estatuto da Criança e do Adolescente (1990) (ECA)", "LEI-8069-1990-07-13", 1990), "Estatuto da Criança e do Adolescente (ECA)");
  assert.equal(nickname("LEI-14116-2020-12-31 , Lei de Diretrizes Orçamentárias - LDO (2021)", "LEI-14116-2020-12-31", 2020), "Lei de Diretrizes Orçamentárias - LDO (2021)");
  assert.equal(cleanEmenta("  Altera   a Lei\n nº 1 "), "Altera a Lei nº 1");
  assert.deepEqual(guessAreas("Institui a Política Nacional de Resíduos Sólidos"), ["saneamento"]);
  assert.equal(legislatureAt("1997-08-28"), 50);
  assert.equal(legislatureAt("1999-01-31"), 50);
  assert.equal(legislatureAt("1999-02-01"), 51);
  assert.equal(partyNameAt("MDB", "2015-01-01"), "PMDB");
  assert.equal(partyNameAt("MDB", "2018-01-01"), "MDB");
  assert.equal(partyNameAt("PL", "2010-01-01"), "PR");
  assert.equal(partyNameAt("PL", "2003-01-01"), "PL");
  assert.equal(partyNameAt("Agir", "1995-01-01"), "PRN");
  assert.equal(presidentAt("1992-11-01")?.party, null);
  assert.equal(presidentAt("2017-06-01")?.party, "PMDB");
  assert.equal(presidentAt("2022-01-01")?.party, "PL");
  assert.equal(presidentAt("1988-06-01")?.name, "José Sarney");
});

test("deputy party: unknown when there is no row for that legislature", () => {
  assert.deepEqual(deputyAt([{ idLegislatura: 52, siglaPartido: "PT", siglaUf: "RS" }], "1997-08-28"), { party: null, uf: null });
});
