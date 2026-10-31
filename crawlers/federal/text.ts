// Text helpers: number formatting, cleaning official ementas and nicknames, and a first-pass area tagger.

/** 14116 -> "14.116" */
export const formatNumber = (n: string | number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "31/12/2020" -> "2020-12-31" */
export function brDateToIso(d: string | null | undefined): string | null {
  const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null);
}

const SMALL = new Set(
  "a ao aos as à às com da das de do dos e em na nas no nos o os ou para pela pelas pelo pelos por que se sem sob sobre um uma".split(" "),
);

const isShouting = (s: string) => {
  const letters = s.replace(/[^\p{L}]/gu, "");
  return letters.length > 3 && letters === letters.toUpperCase();
};

/** Old records are ALL CAPS; turn them into a sentence ("Dispõe sobre ..."). */
export function cleanEmenta(s: string | null | undefined): string {
  let t = (s ?? "").replace(/\s+/g, " ").trim();
  if (isShouting(t)) t = t.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Senado "apelido" is "<NORMA-CODE> , Nickname" or just the code. Returns the nickname or null. */
export function nickname(apelido: string | null | undefined, normaCode: string): string | null {
  if (!apelido) return null;
  const parts = apelido
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter((p) => p && p !== normaCode && !/^(LEI|LCP|MPV)-[\d-]+$/.test(p));
  if (!parts.length) return null;
  let t = parts.join(", ");
  if (isShouting(t)) {
    // Title case; short words that are not Portuguese function words are likely acronyms (ECA, SUS).
    t = t
      .split(/(\s+|\/|-)/)
      .map((w, i) => {
        const lower = w.toLowerCase();
        if (SMALL.has(lower) && i > 0) return lower;
        if (w.length <= 4 && /^\p{Lu}+$/u.test(w) && !SMALL.has(lower)) return w;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join("");
  }
  return t;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Keyword rules over the ementa. A first pass so the area filter works before the planned
 * classifier exists; deliberately conservative (no match -> no area).
 */
const AREA_RULES: [string, RegExp][] = [
  ["saude", /\b(saude|sus|hospita\w*|medic(o|a|os|as|amento\w*)|vacina\w*|doenca\w*|sanitari\w*|farmac\w*|enfermag\w*|epidemi\w*|pandemi\w*|covid)\b/],
  ["educacao", /\b(educac\w*|ensino|escola\w*|universidade\w*|professor\w*|estudant\w*|fundeb|fundef|alfabetiza\w*|creche\w*|bolsas? de estudo)\b/],
  ["meio-ambiente", /\b(ambient\w*|floresta\w*|fauna|flora|unidades? de conservacao|poluic\w*|clima\w*|desmatamento|biodiversidade|recursos hidricos|agrotoxic\w*)\b/],
  ["assistencia-social", /\b(assistencia social|bolsa familia|prestacao continuada|pobreza|fome|auxilio emergencial|seguranca alimentar|renda basica)\b/],
  ["direitos-humanos", /\b(direitos humanos|crianca\w*|adolescente\w*|idos[oa]s?|pessoas? com deficiencia|deficien\w*|mulher\w*|violencia domestica|racia\w*|racismo|indigen\w*|quilombola\w*|igualdade|discrimina\w*|consumidor\w*)\b/],
  ["tecnologia", /\b(internet|dados pessoais|telecomunica\w*|informatica|tecnologi\w*|digita(l|is)|software|ciencia|inovac\w*|radiodifus\w*)\b/],
  ["administracao-publica", /\b(credito (especial|suplementar|extraordinario)|orcament\w*|servidor(es)? publico\w*|cargos?|carreira\w*|administracao publica|licitac\w*|remunerac\w*|quadro de pessoal|reestrutura\w*|tribunal regional|justica (do trabalho|federal|eleitoral))\b/],
  ["urbanismo", /\b(urban\w*|cidades?|mobilidade|habitac\w*|moradia\w*|transito|transporte (publico|urbano|coletivo)|minha casa)\b/],
  ["saneamento", /\b(saneamento|agua potavel|abastecimento de agua|esgot\w*|residuos solidos)\b/],
  ["seguranca", /\b(seguranca publica|crimes?|criminal|penal|penais|pena|policia\w*|armas?|drogas?|entorpecente\w*|presidi\w*|prisional|terroris\w*|lavagem de dinheiro)\b/],
  ["economia", /\b(tribut\w*|impost\w*|contribuic\w* (social|sobre)|fisca(l|is)|financeir\w*|salario minimo|comercio|empresa\w*|bancari\w*|moeda|cambi\w*|previdenc\w*|aposentador\w*|credito rural|agricultur\w*|exporta\w*|importa\w*)\b/],
];

export function guessAreas(text: string): string[] {
  const t = norm(text);
  return AREA_RULES.filter(([, re]) => re.test(t)).map(([k]) => k).slice(0, 3);
}
