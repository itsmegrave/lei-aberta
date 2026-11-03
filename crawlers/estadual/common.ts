/** Helpers shared by the state adapters: law-type detection, ids, titles and the Policy record shape. */
import type { Author, Policy } from "../../lib/types.ts";
import type { StateHouse } from "./states.ts";

/** The law types we collect from state houses. Decrees, resolutions and acts are out of scope. */
export type LawType = "lei" | "lei-complementar" | "emenda-constitucional";

export const TYPE_LABEL: Record<LawType, string> = {
  lei: "Lei",
  "lei-complementar": "Lei Complementar",
  "emenda-constitucional": "Emenda Constitucional",
};

/** Lowercase and strip accents, for comparisons only. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Maps a house's own type name (and SAPL's LexML equivalent, when present) to one of our law types.
 * Returns null for everything else (decreto, resolução, "lei delegada", etc.).
 */
export function lawType(description: string, lexml?: string | null): LawType | null {
  const lx = fold(lexml ?? "");
  // SAPL ships "ementa.constitucional" (sic) in some houses; accept both spellings.
  if (lx === "lei") return "lei";
  if (lx === "lei.complementar") return "lei-complementar";
  if (lx === "emenda.constitucional" || lx === "ementa.constitucional") return "emenda-constitucional";
  const d = fold(description).replace(/\s+/g, " ");
  if (/^lei complementar\b/.test(d)) return "lei-complementar";
  if (/^emenda (a )?constitucional\b|^emenda a constituicao\b/.test(d)) return "emenda-constitucional";
  if (/^lei( ordinaria)?$/.test(d) || /^lei ordinaria\b/.test(d)) return "lei";
  return null;
}

/** "14.738" -> "14738"; keeps a letter complement: ("123", "A") -> "123-a". */
export function bareNumber(n: string | number, complement?: string | null): string {
  const base = String(n).replace(/\./g, "").replace(/^0+(?=\d)/, "").trim();
  const c = (complement ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return c ? `${base}-${c}` : base;
}

/** "1234" -> "1.234" for display. */
export function displayNumber(n: string): string {
  const [base, comp] = n.split("-");
  const d = base.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return comp ? `${d}-${comp.toUpperCase()}` : d;
}

export function stateId(uf: string, type: LawType, number: string, year: number): string {
  return `estadual-${uf.toLowerCase()}-${type}-${number}-${year}`;
}

/** Collapses whitespace and strips stray markup. */
export function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const LETTERS = /[^A-Za-zÀ-ÿ]/g;
const letters = (w: string) => w.replace(LETTERS, "");
const isUpper = (w: string) => letters(w).length > 0 && letters(w) === letters(w).toLocaleUpperCase("pt-BR");
const ROMAN = /^X{0,3}(IX|IV|V?I{0,3})$/;
const PARTICLES = new Set(["a", "à", "ao", "aos", "as", "às", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por"]);
const upFirst = (s: string) => s.replace(/[A-Za-zÀ-ÿ]/, (c) => c.toLocaleUpperCase("pt-BR"));
/** Words no case change touches: numbers ("8º-A"), roman numerals ("XII"), "(ADH/PI)", "S/A". */
const fixedCase = (w: string) => /\d/.test(w) || ROMAN.test(letters(w)) || /^["“]?\(.*\)[,.;:”"]?$/.test(w) || w.includes("/");
/** Inside a normal sentence, short upper-case words are acronyms too ("SUS", "ASA"). */
const acronym = (w: string) => fixedCase(w) || (letters(w).length <= 3 && !PARTICLES.has(letters(w).toLocaleLowerCase("pt-BR")));
const lowerWord = (w: string) => (/^N[º°]S?$/i.test(w.replace(/[,.;:]$/, "")) ? w.toLocaleLowerCase("pt-BR") : fixedCase(w) ? w : w.toLocaleLowerCase("pt-BR"));

/**
 * Some houses keep ementas in ALL CAPS, or shout part of them ("ao GENERAL DE EXÉRCITO FULANO"). A mostly
 * upper-case ementa becomes sentence case; a run of shouted words inside a normal sentence is usually a name, so
 * it becomes title case. Numbers, roman numerals and acronyms keep their case.
 */
export function tameCaps(s: string): string {
  const all = letters(s);
  const upper = all.replace(/[^A-ZÀ-Ý]/g, "").length;
  const words = s.split(" ");
  if (all.length >= 12 && upper / all.length >= 0.8) {
    return upFirst(words.map(lowerWord).join(" "));
  }
  const out = [...words];
  // A shouted first word ("CONSIDERA como de utilidade pública") is just the verb.
  if (words[0] && isUpper(words[0]) && !fixedCase(words[0])) out[0] = upFirst(words[0].toLocaleLowerCase("pt-BR"));
  for (let i = 1; i < words.length; ) {
    let j = i;
    while (j < words.length && isUpper(words[j])) j++;
    const run = words.slice(i, j);
    // Two or more shouted words with at least one real word in them; a lone upper-case word is an acronym.
    if (run.length >= 2 && run.some((w) => letters(w).length >= 4 && !acronym(w))) {
      run.forEach((w, k) => {
        if (acronym(w)) return;
        const lower = w.toLocaleLowerCase("pt-BR");
        out[i + k] = PARTICLES.has(letters(lower)) ? lower : upFirst(lower);
      });
    }
    i = j + 1;
  }
  return out.join(" ");
}

/** Strips the quotes some houses wrap whole ementas in: “altera o “caput” do art. 48.” -> altera o “caput” do art. 48. */
export function unquote(s: string): string {
  if (!/^["“]/.test(s)) return s;
  const inner = s.slice(1);
  if (/["”](\.?)$/.test(inner)) return inner.replace(/["”](\.?)$/, "$1");
  return (inner.match(/["“”]/g)?.length ?? 0) % 2 === 0 ? inner : s;
}

/** Drops a closing quote with no opening one: "... do Estado do Amazonas.”" */
const dropStrayClose = (s: string) => (/[”"]$/.test(s) && (s.match(/["“”]/g)?.length ?? 0) % 2 === 1 ? s.slice(0, -1) : s);

/** Ementa as shown on cards: no markup, no wrapping quotes, no shouting, capital first letter. */
export function tidyEmenta(s: string | null | undefined): string {
  return upFirst(tameCaps(dropStrayClose(unquote(clean(s)))));
}

/** A short card title from an ementa: its first clause, cut at a word boundary. The full ementa stays in `summary`. */
export function shortTitle(ementa: string, max = 90): string {
  // Sentence breaks only: a ";" or a "." after a word of 4+ letters followed by a capital. That keeps
  // abbreviations such as "art. 1º" or "inc. II" inside the title.
  const first = ementa
    .split(/(?<=;)\s|(?<=[A-Za-zÀ-ÿ]{4,}\.)\s+(?=[A-ZÀ-Ý])|,?\s+e\s+d[áa]\s+outras\s+provid[êe]ncias/)[0]
    .replace(/[.;,]\s*$/, "")
    .trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

export function capSummary(s: string, max = 400): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Makes an official link https (several SAPL houses still emit http:// media links). */
export function https(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

/** Situation words from the houses mapped to our status vocabulary. Unknown -> "sancionada". */
export function statusFrom(text: string | null | undefined): string {
  const t = fold(text ?? "");
  if (/revogad/.test(t)) return "revogada";
  if (/inconstitucional/.test(t)) return "declarada inconstitucional";
  if (/suspens/.test(t)) return "suspensa";
  return "sancionada";
}

export interface DraftLaw {
  house: StateHouse;
  type: LawType;
  number: string;
  year: number;
  /** Date the law was signed or promulgated, YYYY-MM-DD. */
  date: string | null;
  ementa: string;
  presentedAt?: string | null;
  /** Originating bill as the house writes it, e.g. "PL 403/2023". */
  bill?: string | null;
  status?: string;
  authors?: Author[];
  sources: Policy["sources"];
}

/** Builds the record. `executive` stays null: governors' parties come from TSE data, never from author data. */
export function toPolicy(d: DraftLaw): Policy {
  const ementa = tidyEmenta(d.ementa);
  const label = `${TYPE_LABEL[d.type]} nº ${displayNumber(d.number)}/${d.year}`;
  const authors = d.authors ?? [];
  const parties = [...new Set(authors.filter((a) => a.kind !== "executive" && a.party).map((a) => a.party!))].sort();
  return {
    id: stateId(d.house.uf, d.type, d.number, d.year),
    level: "estadual",
    jurisdiction: d.house.state,
    type: d.type,
    number: displayNumber(d.number),
    title: ementa ? shortTitle(ementa) : label,
    summary: ementa ? capSummary(ementa) : label,
    year: d.year,
    presentedAt: d.presentedAt ?? null,
    status: d.status ?? "sancionada",
    areas: [],
    authors,
    parties,
    executive: null,
    sources: d.sources,
    signedAt: d.date,
    bill: d.bill ? clean(d.bill) : null,
  };
}

export interface AdapterResult {
  records: Policy[];
  errors: string[];
  /** Diagnostics printed by run.ts (types matched, join counts). */
  info?: string[];
}
