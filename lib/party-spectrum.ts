/**
 * Party positions on the left-right scale (0 = left, 10 = right), copied from Table 1 of
 * Bolognesi, Ribeiro & Codato (2023), "A New Ideological Classification of Brazilian
 * Political Parties", Dados 66(2). https://doi.org/10.1590/dados.2023.66.2.303
 *
 * We do not score parties ourselves. Parties missing from the survey get no position.
 */
export const SPECTRUM_SOURCE = {
  label: "Bolognesi, Ribeiro e Codato (2023), Dados 66(2)",
  url: "https://doi.org/10.1590/dados.2023.66.2.303",
};

export const PARTY_SCORES: Record<string, number> = {
  PSTU: 0.51, PCO: 0.61, PCB: 0.91, PSOL: 1.28, PCdoB: 1.92, PT: 2.97, PDT: 3.92, PSB: 4.05,
  Rede: 4.77, PPS: 4.92, PV: 5.29, PTB: 6.1, Avante: 6.32, SDD: 6.5, PMN: 6.88, PMB: 6.9,
  PHS: 6.96, MDB: 7.01, PSD: 7.09, PSDB: 7.11, Podemos: 7.24, PPL: 7.27, PRTB: 7.45, Pros: 7.47,
  PRP: 7.59, PRB: 7.78, PR: 7.78, PTC: 7.86, DC: 8.11, PSL: 8.11, Novo: 8.13, Progressistas: 8.2,
  PSC: 8.33, Patriota: 8.55, DEM: 8.57,
};

/**
 * Former names of the same registered party (a rename, not a merger), so older laws
 * can use the survey score. Only formal renames belong here.
 */
export const RENAMED_TO: Record<string, string> = {
  PMDB: "MDB", // renamed 2017
  PFL: "DEM", // renamed 2007
  PRN: "PTC", // renamed 2000
  PP: "Progressistas", // renamed 2017
  PPB: "Progressistas", // PPB -> PP (2003) -> Progressistas (2017)
  "Cidadania": "PPS", // PPS renamed Cidadania in 2019
  "Solidariedade": "SDD",
  "Republicanos": "PRB", // renamed 2019
  "PL": "PR", // PR renamed back to PL in 2019
};

export function partyScore(party: string | null | undefined): number | null {
  if (!party) return null;
  const key = PARTY_SCORES[party] != null ? party : RENAMED_TO[party];
  return key != null && PARTY_SCORES[key] != null ? PARTY_SCORES[key] : null;
}

// ---- Diverging color: violet (left) -> gray (center) -> ochre (right). No red/green. ----
type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab([r, g, b]: Rgb): Rgb {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]: Rgb): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, delin(c)))).toString(16).padStart(2, "0")).join("");
}

export const SPECTRUM_STOPS = {
  light: { left: "#6a3fc9", mid: "#8f8e88", right: "#a8740a", none: "#d4d3cd" },
  dark: { left: "#8e72e8", mid: "#7a7973", right: "#bf8a22", none: "#3a3a37" },
} as const;

/** Color for a 0-10 score; null score gets the "no position" gray. */
export function spectrumColor(score: number | null, mode: "light" | "dark" = "light"): string {
  const s = SPECTRUM_STOPS[mode];
  if (score == null) return s.none;
  // Ease away from the gray midpoint so parties near the center still read as leaning one way.
  // Position on the scale (not color) carries the exact value.
  const u = Math.min(1, Math.max(0, score / 10)) * 2 - 1;
  const t = (Math.sign(u) * Math.abs(u) ** 0.6 + 1) / 2;
  const [a, b, k] = t < 0.5 ? [s.left, s.mid, t / 0.5] : [s.mid, s.right, (t - 0.5) / 0.5];
  const A = toOklab(hex(a)), B = toOklab(hex(b));
  return fromOklab([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * k) as Rgb);
}
