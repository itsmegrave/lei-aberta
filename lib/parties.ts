/**
 * Party directory: the parties registered at the TSE today, their national history (renames, mergers,
 * incorporations) and the former names that point to each of them.
 *
 * Laws keep the author's party AT THE TIME of authorship in the data. This file is only used to:
 *   - group and label charts by the party's current name (PMDB -> MDB, PFL/DEM -> União Brasil, PPS -> Cidadania);
 *   - build the party pages (/partidos and /partidos/<slug>).
 *
 * Sources (checked 2026-10-31):
 *   - TSE, "Partidos políticos registrados no TSE": sigla, name, number, registration date and website of each party.
 *     https://www.tse.jus.br/partidos/partidos-registrados-no-tse
 *   - Each party's TSE page (tsePath below) for the website.
 *   - Renames, mergers and incorporations: TSE decisions as reported in the press and in the parties' own statutes;
 *     the main ones are linked in `sources` of each party.
 *
 * Rules:
 *   - A rename keeps the party (same registration). A merger ("fusão") creates a new party. An incorporation keeps
 *     the absorbing party. All three point the old name to the party that exists today.
 *   - Left-right scores come only from the survey (lib/party-spectrum.ts). A party created by a merger after the
 *     survey (União Brasil, PRD) has no score of its own, so it gets none: we don't average or invent one.
 *   - Text is neutral: dates and facts, no adjectives, no ideology labels of our own.
 */

export interface PartyEvent {
  /** Null when the year could not be confirmed from a primary source. */
  year: number | null;
  text: string;
}

export interface Party {
  /** URL slug: /partidos/<slug>. */
  slug: string;
  /** Name used in charts and lists: the party's current short name. */
  short: string;
  /** Full name as registered at the TSE (sentence case). */
  name: string;
  /** Electoral number. */
  number: number;
  /** TSE registration ("deferimento do registro"), ISO date. */
  registeredAt: string;
  /** Official website, as listed by the TSE (or the party's own domain when the TSE leaves it blank). */
  website: string | null;
  /** Path of the party's page under https://www.tse.jus.br/partidos/partidos-registrados-no-tse/. */
  tsePath: string;
  /** Key in PARTY_SCORES for this party (same registration, possibly under an older name). */
  survey: string | null;
  /** One or two neutral sentences. */
  about: string;
  history: PartyEvent[];
  /** Extra sources for the history, besides the TSE pages. */
  sources?: { label: string; url: string }[];
}

export const PARTIES_PATH = "/partidos";
export const partyPath = (slug: string) => `${PARTIES_PATH}/${slug}`;

export const TSE_PARTIES_URL = "https://www.tse.jus.br/partidos/partidos-registrados-no-tse";
export const tseUrl = (p: Pick<Party, "tsePath">) => `${TSE_PARTIES_URL}/${p.tsePath}`;

export const PARTIES: Party[] = [
  {
    slug: "mdb", short: "MDB", name: "Movimento Democrático Brasileiro", number: 15, registeredAt: "1981-06-30",
    website: "https://www.mdb.org.br", tsePath: "movimento-democratico-brasileiro", survey: "MDB",
    about: "Vem do MDB criado em 1966, o partido de oposição permitido no bipartidarismo do regime militar.",
    history: [
      { year: 1966, text: "Criado o MDB, na época em que só dois partidos podiam existir (MDB e Arena)." },
      { year: 1980, text: "Com o fim do bipartidarismo, passa a se chamar PMDB." },
      { year: 1981, text: "Registro definitivo no TSE como PMDB." },
      { year: 2017, text: "Volta a usar o nome MDB." },
    ],
  },
  {
    slug: "pdt", short: "PDT", name: "Partido Democrático Trabalhista", number: 12, registeredAt: "1981-11-10",
    website: "https://www.pdt.org.br", tsePath: "partido-democratico-trabalhista", survey: "PDT",
    about: "Fundado por Leonel Brizola e aliados depois que o grupo perdeu na Justiça Eleitoral a disputa pela sigla PTB.",
    history: [
      { year: 1980, text: "Fundação, após a sigla PTB ficar com outro grupo." },
      { year: 1981, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "pt", short: "PT", name: "Partido dos Trabalhadores", number: 13, registeredAt: "1982-02-11",
    website: "https://www.pt.org.br", tsePath: "partido-dos-trabalhadores", survey: "PT",
    about: "Fundado em São Paulo por sindicalistas, integrantes de movimentos sociais e intelectuais.",
    history: [
      { year: 1980, text: "Fundação, em 10 de fevereiro." },
      { year: 1982, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "pcdob", short: "PCdoB", name: "Partido Comunista do Brasil", number: 65, registeredAt: "1988-06-23",
    website: "https://www.pcdob.org.br", tsePath: "partido-comunista-do-brasil", survey: "PCdoB",
    about: "Surgiu em 1962 de uma divisão do antigo Partido Comunista e voltou à legalidade em 1985.",
    history: [
      { year: 1962, text: "Formado a partir de uma divisão do Partido Comunista." },
      { year: 1985, text: "Volta à legalidade." },
      { year: 1988, text: "Registro definitivo no TSE." },
      { year: 2019, text: "Incorpora o PPL (Partido Pátria Livre)." },
    ],
  },
  {
    slug: "psb", short: "PSB", name: "Partido Socialista Brasileiro", number: 40, registeredAt: "1988-07-01",
    website: "https://www.psb40.org.br", tsePath: "partido-socialista-brasileiro", survey: "PSB",
    about: "Criado em 1947, extinto em 1965 junto com os demais partidos e refundado em 1985.",
    history: [
      { year: 1947, text: "Primeira fundação." },
      { year: 1965, text: "Extinto pelo Ato Institucional nº 2, como todos os partidos da época." },
      { year: 1985, text: "Refundação." },
      { year: 1988, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "psdb", short: "PSDB", name: "Partido da Social Democracia Brasileira", number: 45, registeredAt: "1989-08-24",
    website: "https://www.psdb.org.br", tsePath: "partido-da-social-democracia-brasileira", survey: "PSDB",
    about: "Fundado em 1988 por parlamentares que saíram do PMDB durante a Assembleia Constituinte.",
    history: [
      { year: 1988, text: "Fundação, em 25 de junho." },
      { year: 1989, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "agir", short: "Agir", name: "Agir", number: 36, registeredAt: "1990-02-22",
    website: "https://agir36.com.br", tsePath: "agir", survey: "PTC",
    about: "É o antigo PRN, partido pelo qual Fernando Collor foi eleito presidente em 1989. Depois se chamou PTC.",
    history: [
      { year: null, text: "Fundado como Partido da Juventude (PJ)." },
      { year: 1989, text: "Passa a se chamar Partido da Reconstrução Nacional (PRN)." },
      { year: 1990, text: "Registro definitivo no TSE." },
      { year: 2000, text: "Muda o nome para Partido Trabalhista Cristão (PTC)." },
      { year: 2022, text: "Muda o nome para Agir." },
    ],
  },
  {
    slug: "mobiliza", short: "Mobiliza", name: "Mobilização Nacional", number: 33, registeredAt: "1990-10-25",
    website: "https://www.mobiliza.org.br", tsePath: "partido-da-mobilizacao-nacional", survey: "PMN",
    about: "É o antigo PMN (Partido da Mobilização Nacional), fundado em 1984.",
    history: [
      { year: 1984, text: "Fundação como Partido da Mobilização Nacional (PMN)." },
      { year: 1990, text: "Registro definitivo no TSE." },
      { year: null, text: "Passa a usar o nome Mobilização Nacional (Mobiliza)." },
    ],
    sources: [{ label: "Politize: história do Mobiliza", url: "https://www.politize.com.br/mobiliza/" }],
  },
  {
    slug: "cidadania", short: "Cidadania", name: "Cidadania", number: 23, registeredAt: "1992-03-19",
    website: "https://cidadania23.org.br", tsePath: "cidadania", survey: "PPS",
    about: "É o antigo Partido Comunista Brasileiro (PCB), que virou PPS em 1992 e Cidadania em 2019.",
    history: [
      { year: 1922, text: "Fundação do Partido Comunista." },
      { year: 1992, text: "Passa a se chamar Partido Popular Socialista (PPS). Quem discordou da mudança refundou o PCB." },
      { year: 2019, text: "Muda o nome para Cidadania." },
    ],
  },
  {
    slug: "pv", short: "PV", name: "Partido Verde", number: 43, registeredAt: "1993-09-30",
    website: "https://www.pv.org.br", tsePath: "partido-verde", survey: "PV",
    about: "Fundado em 1986 em torno de pautas ambientais.",
    history: [
      { year: 1986, text: "Fundação." },
      { year: 1993, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "avante", short: "Avante", name: "Avante", number: 70, registeredAt: "1994-10-11",
    website: "https://www.avante70.org.br", tsePath: "partido-trabalhista-do-brasil", survey: "Avante",
    about: "É o antigo PTdoB (Partido Trabalhista do Brasil).",
    history: [
      { year: 1994, text: "Registro definitivo no TSE como PTdoB." },
      { year: 2017, text: "Muda o nome para Avante." },
    ],
  },
  {
    slug: "pp", short: "PP", name: "Progressistas", number: 11, registeredAt: "1995-11-16",
    website: "https://www.pp.org.br", tsePath: "partido-progressista", survey: "Progressistas",
    about: "Vem do PDS, sucessor da Arena, por uma série de fusões nos anos 1990. Já se chamou PPR, PPB e PP.",
    history: [
      { year: 1980, text: "Criado o PDS, a partir da Arena." },
      { year: 1993, text: "PDS e PDC se fundem no PPR. No mesmo ano, PTR e PST se fundem num partido chamado PP." },
      { year: 1995, text: "PPR e PP se fundem no Partido Progressista Brasileiro (PPB), registrado no TSE." },
      { year: 2003, text: "Muda o nome para Partido Progressista (PP)." },
      { year: 2017, text: "Muda o nome para Progressistas, mantendo a sigla PP." },
    ],
  },
  {
    slug: "pstu", short: "PSTU", name: "Partido Socialista dos Trabalhadores Unificado", number: 16, registeredAt: "1995-12-19",
    website: "https://www.pstu.org.br", tsePath: "partido-socialista-dos-trabalhadores-unificado", survey: "PSTU",
    about: "Fundado em 1994 por grupos que saíram do PT.",
    history: [
      { year: 1994, text: "Fundação." },
      { year: 1995, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "pcb", short: "PCB", name: "Partido Comunista Brasileiro", number: 21, registeredAt: "1996-05-09",
    website: "https://www.pcb.org.br", tsePath: "partido-comunista-brasileiro", survey: "PCB",
    about: "Refundado em 1992 por quem não aceitou a transformação do antigo PCB em PPS (hoje Cidadania).",
    history: [
      { year: 1992, text: "Refundação, depois que o antigo PCB virou PPS." },
      { year: 1996, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "prtb", short: "PRTB", name: "Partido Renovador Trabalhista Brasileiro", number: 28, registeredAt: "1997-02-18",
    website: "https://www.prtb.org.br", tsePath: "partido-renovador-trabalhista-brasileiro", survey: "PRTB",
    about: "Fundado em 1994.",
    history: [
      { year: 1994, text: "Fundação." },
      { year: 1997, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "dc", short: "DC", name: "Democracia Cristã", number: 27, registeredAt: "1997-08-05",
    website: "https://www.democraciacrista.org.br", tsePath: "partido-social-democrata-cristao", survey: "DC",
    about: "É o antigo PSDC (Partido Social Democrata Cristão).",
    history: [
      { year: 1995, text: "Fundação como PSDC." },
      { year: 1997, text: "Registro definitivo no TSE." },
      { year: 2017, text: "Muda o nome para Democracia Cristã (DC)." },
    ],
  },
  {
    slug: "pco", short: "PCO", name: "Partido da Causa Operária", number: 29, registeredAt: "1997-09-30",
    website: "https://www.pco.org.br", tsePath: "partido-da-causa-operaria", survey: "PCO",
    about: "Fundado em 1995 por um grupo que saiu do PT.",
    history: [
      { year: 1995, text: "Fundação." },
      { year: 1997, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "podemos", short: "Podemos", name: "Podemos", number: 20, registeredAt: "1997-10-02",
    website: "https://www.podemos.org.br", tsePath: "partido-trabalhista-nacional", survey: "Podemos",
    about: "É o antigo PTN (Partido Trabalhista Nacional). Incorporou o PHS e o PSC.",
    history: [
      { year: 1997, text: "Registro definitivo no TSE como PTN." },
      { year: 2017, text: "Muda o nome para Podemos." },
      { year: 2019, text: "Incorpora o PHS (Partido Humanista da Solidariedade)." },
      { year: 2023, text: "Incorpora o PSC (Partido Social Cristão)." },
    ],
  },
  {
    slug: "republicanos", short: "Republicanos", name: "Republicanos", number: 10, registeredAt: "2005-08-25",
    website: "https://republicanos10.org.br", tsePath: "republicanos", survey: "PRB",
    about: "É o antigo PRB (Partido Republicano Brasileiro).",
    history: [
      { year: 2005, text: "Registro definitivo no TSE como PRB." },
      { year: 2019, text: "Muda o nome para Republicanos." },
    ],
  },
  {
    slug: "psol", short: "PSOL", name: "Partido Socialismo e Liberdade", number: 50, registeredAt: "2005-09-15",
    website: "https://www.psol50.org.br", tsePath: "partido-socialismo-e-liberdade", survey: "PSOL",
    about: "Fundado em 2004 por parlamentares e militantes que saíram do PT.",
    history: [
      { year: 2004, text: "Fundação." },
      { year: 2005, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "pl", short: "PL", name: "Partido Liberal", number: 22, registeredAt: "2006-12-19",
    website: "https://partidoliberal.org.br", tsePath: "partido-da-republica", survey: "PR",
    about: "Nasceu da fusão do antigo PL com o Prona em 2006, com o nome PR, e voltou a se chamar PL em 2019.",
    history: [
      { year: 1985, text: "Fundação do antigo Partido Liberal (PL)." },
      { year: 2003, text: "O antigo PL incorpora o PST e o PGT." },
      { year: 2006, text: "PL e Prona se fundem no Partido da República (PR)." },
      { year: 2019, text: "Muda o nome para Partido Liberal (PL)." },
    ],
  },
  {
    slug: "psd", short: "PSD", name: "Partido Social Democrático", number: 55, registeredAt: "2011-09-27",
    website: "https://www.psd.org.br", tsePath: "partido-social-democratico", survey: "PSD",
    about: "Fundado em 2011. Não tem ligação de registro com o PSD que existiu de 1987 a 2003.",
    history: [{ year: 2011, text: "Fundação e registro definitivo no TSE." }],
  },
  {
    slug: "solidariedade", short: "Solidariedade", name: "Solidariedade", number: 77, registeredAt: "2013-09-24",
    website: "https://www.solidariedade.org.br", tsePath: "solidariedade", survey: "SDD",
    about: "Fundado em 2013. Em 2023 o Pros se juntou a ele, que manteve nome e número.",
    history: [
      { year: 2013, text: "Fundação e registro definitivo no TSE." },
      { year: 2023, text: "O Pros (Partido Republicano da Ordem Social) se junta ao Solidariedade." },
    ],
    sources: [{ label: "CNN Brasil: TSE aprova união de Pros e Solidariedade", url: "https://www.cnnbrasil.com.br/politica/tse-aprova-fusao-entre-pros-e-solidariedade/" }],
  },
  {
    slug: "novo", short: "Novo", name: "Partido Novo", number: 30, registeredAt: "2015-09-15",
    website: "https://www.novo.org.br", tsePath: "partido-novo", survey: "Novo",
    about: "Fundado em 2011 e registrado em 2015.",
    history: [
      { year: 2011, text: "Fundação." },
      { year: 2015, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "rede", short: "Rede", name: "Rede Sustentabilidade", number: 18, registeredAt: "2015-09-22",
    website: "https://www.redesustentabilidade.org.br", tsePath: "rede", survey: "Rede",
    about: "Fundado em 2013 por um grupo liderado por Marina Silva e registrado em 2015.",
    history: [
      { year: 2013, text: "Fundação." },
      { year: 2015, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "democrata", short: "Democrata", name: "Democrata", number: 35, registeredAt: "2015-09-29",
    website: "https://democrata.org.br", tsePath: "democrata", survey: "PMB",
    about: "É o antigo PMB (Partido da Mulher Brasileira).",
    history: [
      { year: 2015, text: "Registro definitivo no TSE como PMB." },
      { year: 2025, text: "O TSE aprova a mudança de nome para Democrata, em 2 de dezembro." },
    ],
    sources: [{ label: "A Tarde: TSE autoriza Partido da Mulher Brasileira a mudar de nome", url: "https://atarde.com.br/politica/tse-autoriza-partido-da-mulher-brasileira-a-mudar-de-nome-1371015" }],
  },
  {
    slug: "up", short: "UP", name: "Unidade Popular", number: 80, registeredAt: "2019-12-10",
    website: "https://unidadepopular.org.br", tsePath: "unidade-popular", survey: null,
    about: "Fundado em 2016 e registrado em 2019. Não fazia parte da pesquisa usada para as posições.",
    history: [
      { year: 2016, text: "Fundação." },
      { year: 2019, text: "Registro definitivo no TSE." },
    ],
  },
  {
    slug: "uniao", short: "União Brasil", name: "União Brasil", number: 44, registeredAt: "2022-02-08",
    website: "https://www.uniaobrasil.org.br", tsePath: "uniao-brasil", survey: null,
    about: "Criado em 2022 pela fusão do DEM (antigo PFL) com o PSL. Como é um partido novo, não tem posição própria na pesquisa.",
    history: [
      { year: 1985, text: "Fundado o PFL (Partido da Frente Liberal), por um grupo que saiu do PDS." },
      { year: 1994, text: "Fundado o PSL (Partido Social Liberal)." },
      { year: 2007, text: "O PFL muda o nome para Democratas (DEM)." },
      { year: 2022, text: "DEM e PSL se fundem no União Brasil, registrado no TSE em 8 de fevereiro." },
    ],
  },
  {
    slug: "prd", short: "PRD", name: "Partido Renovação Democrática", number: 25, registeredAt: "2023-11-09",
    website: "https://prd25.org.br", tsePath: "partido-renovacao-democratica-prd", survey: null,
    about: "Criado em 2023 pela fusão do PTB com o Patriota. Como é um partido novo, não tem posição própria na pesquisa.",
    history: [
      { year: 1980, text: "Refundação do PTB (Partido Trabalhista Brasileiro)." },
      { year: 2003, text: "O PTB incorpora o antigo PSD (1987-2003)." },
      { year: 2012, text: "Registrado o PEN (Partido Ecológico Nacional), que em 2018 vira Patriota." },
      { year: 2019, text: "O Patriota incorpora o PRP (Partido Republicano Progressista)." },
      { year: 2023, text: "PTB e Patriota se fundem no PRD, registrado no TSE em 9 de novembro." },
    ],
    sources: [{ label: "Folha de Pernambuco: TSE aprova criação do PRD", url: "https://www.folhape.com.br/politica/tse-aprova-criacao-do-prd-resultado-de-fusao-entre-ptb-e-patriota/300776/" }],
  },
  {
    slug: "missao", short: "Missão", name: "Partido Missão", number: 14, registeredAt: "2025-11-04",
    website: "https://missao.org.br", tsePath: "partido-missao", survey: null,
    about: "Criado por integrantes do Movimento Brasil Livre (MBL) e registrado em 2025. Não fazia parte da pesquisa usada para as posições.",
    history: [{ year: 2025, text: "Registro definitivo no TSE, em 4 de novembro." }],
  },
];

/**
 * Party codes found in the records (any case) and the party they belong to today.
 * `survey` is the score of THAT party at the time (a rename keeps the score; an absorbed party keeps its own),
 * used where a law shows the party at authorship. `from`/`until` split codes reused by different parties (by law year).
 */
interface Alias {
  code: string;
  slug: string;
  survey?: string | null;
  from?: number;
  until?: number;
}

const ALIASES: Alias[] = [
  { code: "PMDB", slug: "mdb", survey: "MDB" },
  { code: "PPL", slug: "pcdob", survey: "PPL" },
  { code: "PRN", slug: "agir", survey: "PTC" },
  { code: "PTC", slug: "agir", survey: "PTC" },
  { code: "PJ", slug: "agir", survey: "PTC" },
  { code: "PMN", slug: "mobiliza", survey: "PMN" },
  { code: "PPS", slug: "cidadania", survey: "PPS" },
  // The old PCB became PPS in January 1992; the PCB after that is the refounded party.
  { code: "PCB", slug: "cidadania", survey: "PPS", until: 1991 },
  { code: "PTDOB", slug: "avante", survey: "Avante" },
  { code: "PT DO B", slug: "avante", survey: "Avante" },
  { code: "PROGRESSISTAS", slug: "pp", survey: "Progressistas" },
  { code: "PPB", slug: "pp", survey: "Progressistas" },
  { code: "PPR", slug: "pp", survey: null },
  { code: "PDS", slug: "pp", survey: null },
  { code: "PTR", slug: "pp", survey: null },
  // PDC (1985-1993) merged into PPR; PST (1988-1993) merged into the PP of 1993. A second PST (1996-2003) went to PL.
  { code: "PDC", slug: "pp", survey: null, until: 1995 },
  { code: "PST", slug: "pp", survey: null, until: 1995 },
  { code: "PST", slug: "pl", survey: null, from: 1996 },
  { code: "PSDC", slug: "dc", survey: "DC" },
  { code: "PODE", slug: "podemos", survey: "Podemos" },
  { code: "PTN", slug: "podemos", survey: "Podemos" },
  { code: "PHS", slug: "podemos", survey: "PHS" },
  { code: "PSC", slug: "podemos", survey: "PSC" },
  { code: "PRB", slug: "republicanos", survey: "PRB" },
  // Early name of the PRB, still used by some house records.
  { code: "PMR", slug: "republicanos", survey: "PRB" },
  { code: "PR", slug: "pl", survey: "PR" },
  { code: "PRONA", slug: "pl", survey: null },
  { code: "PGT", slug: "pl", survey: null },
  // The PSD of 1987-2003 was incorporated by the PTB, now part of PRD.
  { code: "PSD", slug: "prd", survey: null, until: 2010 },
  { code: "SD", slug: "solidariedade", survey: "SDD" },
  { code: "SDD", slug: "solidariedade", survey: "SDD" },
  { code: "PROS", slug: "solidariedade", survey: "Pros" },
  { code: "PMB", slug: "democrata", survey: "PMB" },
  { code: "UNIÃO", slug: "uniao", survey: null },
  { code: "DEM", slug: "uniao", survey: "DEM" },
  { code: "DEMOCRATAS", slug: "uniao", survey: "DEM" },
  { code: "PFL", slug: "uniao", survey: "DEM" },
  { code: "PSL", slug: "uniao", survey: "PSL" },
  { code: "PTB", slug: "prd", survey: "PTB" },
  { code: "PATRIOTA", slug: "prd", survey: "Patriota" },
  { code: "PATRI", slug: "prd", survey: "Patriota" },
  { code: "PEN", slug: "prd", survey: "Patriota" },
  { code: "PRP", slug: "prd", survey: "PRP" },
  { code: "PAN", slug: "prd", survey: null },
];

/** Codes that mean "no party" in house records. */
const NO_PARTY_CODES = new Set(["S/PARTIDO", "S.PART.", "SEM PARTIDO"]);

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase();

const BY_SLUG = new Map(PARTIES.map((p) => [p.slug, p]));
const BY_CODE = new Map<string, Party>();
for (const p of PARTIES) for (const k of [p.short, p.slug, p.name]) BY_CODE.set(fold(k), p);
const ALIAS_BY_CODE = new Map<string, Alias[]>();
for (const a of ALIASES) ALIAS_BY_CODE.set(fold(a.code), [...(ALIAS_BY_CODE.get(fold(a.code)) ?? []), a]);

export const partyBySlug = (slug: string) => BY_SLUG.get(slug);

function aliasOf(code: string, year?: number): Alias | undefined {
  const list = ALIAS_BY_CODE.get(fold(code));
  if (!list) return undefined;
  if (year == null) return list.find((a) => a.from == null && a.until == null) ?? (BY_CODE.has(fold(code)) ? undefined : list[0]);
  return list.find((a) => (a.from == null || year >= a.from) && (a.until == null || year <= a.until));
}

/** An alias limited to a period beats the current party with the same code (PSD before 2011 is not today's PSD). */
const periodAlias = (code: string, year?: number) => {
  const a = aliasOf(code, year);
  return a && (a.from != null || a.until != null) ? a : undefined;
};

export const isNoPartyCode = (code: string) => NO_PARTY_CODES.has(fold(code));

/** The party a code belongs to today. `year` (the law's year) settles codes reused by different parties. */
export function partyOf(code: string | null | undefined, year?: number): Party | null {
  if (!code || isNoPartyCode(code)) return null;
  const period = periodAlias(code, year);
  if (period) return BY_SLUG.get(period.slug) ?? null;
  const direct = BY_CODE.get(fold(code));
  if (direct) return direct;
  const alias = aliasOf(code, year);
  return alias ? BY_SLUG.get(alias.slug) ?? null : null;
}

/** Chart label: the party's current short name, or the code itself when we don't know the party. */
export function currentName(code: string, year?: number): string {
  return partyOf(code, year)?.short ?? code;
}

/**
 * Survey key for a code as the party was at the time: DEM keeps DEM's score although it is part of União Brasil today.
 * `undefined` means the code is unknown here.
 */
export function surveyKeyAtTime(code: string, year?: number): string | null | undefined {
  const period = periodAlias(code, year);
  if (period) return period.survey ?? null;
  const direct = BY_CODE.get(fold(code));
  if (direct) return direct.survey;
  const alias = aliasOf(code, year);
  return alias ? alias.survey ?? null : undefined;
}

/** Former codes of a party, as they appear in the alias table (for "also counted as" notes). */
export function formerCodes(slug: string): string[] {
  return [...new Set(ALIASES.filter((a) => a.slug === slug).map((a) => a.code))];
}

/** The party a law's code points to, when that code is an older name or a party since merged into another. */
export function renamedTo(code: string | null | undefined, year?: number): Party | null {
  const now = partyOf(code, year);
  if (!now || !code) return null;
  const f = fold(code);
  return [now.short, now.slug, now.name].some((k) => fold(k) === f) ? null : now;
}
