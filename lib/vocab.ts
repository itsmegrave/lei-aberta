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
  committee: "Comissão do Congresso",
  judiciary: "Poder Judiciário",
  prosecution: "Ministério Público",
  other: "Outra autoria",
};

/** Record types: [short, long] labels. "lei complementar" (with a space) is the legacy spelling. */
const TYPE_LABEL: Record<string, [string, string]> = {
  lei: ["Lei", "Lei"],
  "lei-complementar": ["Lei Compl.", "Lei Complementar"],
  "lei complementar": ["Lei Compl.", "Lei Complementar"],
  "medida-provisoria": ["MP", "Medida Provisória"],
};
export const typeLabel = (type: string, long = false) => (TYPE_LABEL[type] ?? [type, type])[long ? 1 : 0];
/** "Lei 14.026", "MP 2.200-2". */
export const lawLabel = (p: { type: string; number?: string }, long = false) => `${typeLabel(p.type, long)} ${p.number ?? ""}`.trim();

export const STATUS_LABEL: Record<string, string> = {
  sancionada: "Sancionada",
  "em-tramitacao": "Em tramitação",
  convertida: "Convertida em lei",
  rejeitada: "Rejeitada",
  "perdeu-eficacia": "Perdeu a validade",
  revogada: "Revogada",
  "sem-informacao": "Sem informação",
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

/** Everyday words that should find the right laws. */
export const SEARCH_ALIASES: Record<string, string> = {
  escola: "educacao",
  internet: "tecnologia",
  dados: "dados",
  mulher: "violencia mulher",
  idosos: "idosa",
  agua: "saneamento",
};

/** Brazil's 27 states (UF), by code. */
export const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export const fmt = new Intl.NumberFormat("pt-BR");
export const plural = (n: number) => `${fmt.format(n)} ${n === 1 ? "lei" : "leis"}`;
