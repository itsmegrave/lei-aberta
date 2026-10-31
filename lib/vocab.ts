import type { Level } from "./types";

export const LEVELS: { key: Level; label: string; color: string }[] = [
  { key: "federal", label: "Federal", color: "var(--chart-1)" },
  { key: "estadual", label: "Estadual", color: "var(--chart-2)" },
  { key: "municipal", label: "Municipal", color: "var(--chart-3)" },
];

export interface AreaInfo {
  label: string;
  /** Topic tint token suffix: var(--t-<tint>) and var(--t-<tint>-bg). */
  tint: string;
  /** Fluent Emoji 3D file in /public/emoji. */
  emoji: string;
}

/** Plain-language names people recognize, not legal jargon. */
export const AREAS: Record<string, AreaInfo> = {
  saude: { label: "Saúde", tint: "saude", emoji: "stethoscope" },
  educacao: { label: "Educação", tint: "edu", emoji: "books" },
  "meio-ambiente": { label: "Meio ambiente", tint: "amb", emoji: "deciduous-tree" },
  "assistencia-social": { label: "Assistência social", tint: "ass", emoji: "hugging-face" },
  "direitos-humanos": { label: "Direitos e cidadania", tint: "dir", emoji: "balance-scale" },
  tecnologia: { label: "Internet e tecnologia", tint: "tec", emoji: "mobile-phone" },
  "administracao-publica": { label: "Governo e contas", tint: "gov", emoji: "classical-building" },
  urbanismo: { label: "Cidades", tint: "cid", emoji: "cityscape" },
  saneamento: { label: "Água e esgoto", tint: "san", emoji: "droplet" },
  seguranca: { label: "Segurança", tint: "seg", emoji: "shield" },
  economia: { label: "Economia", tint: "eco", emoji: "coin" },
};

export const area = (key: string): AreaInfo => AREAS[key] ?? { label: key, tint: "gov", emoji: "scroll" };
export const emojiSrc = (name: string) => `/emoji/${name}.webp`;

export const AUTHOR_KIND: Record<string, string> = {
  executive: "Projeto enviado pelo governo",
  senator: "Senado",
  deputy: "Câmara dos Deputados",
  "state-deputy": "Assembleia Legislativa",
  councilor: "Câmara Municipal",
};

/** Everyday words that should find the right laws. */
export const SEARCH_ALIASES: Record<string, string> = {
  escola: "educacao",
  internet: "tecnologia",
  dados: "dados",
  mulher: "violencia mulher",
  idosos: "idosa",
  agua: "saneamento",
};

export const fmt = new Intl.NumberFormat("pt-BR");
export const plural = (n: number) => `${fmt.format(n)} ${n === 1 ? "lei" : "leis"}`;
