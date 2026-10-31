/** Text helpers shared by the Diário Oficial parsers (DOU and municipal gazettes). */

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Lowercase and strip accents, for comparisons only. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "16", "setembro", "2024" -> "2024-09-16", or null when the month is not a Portuguese month name. */
export function isoDate(day: string, month: string, year: string): string | null {
  const m = MONTHS[fold(month)];
  const d = Number(day);
  if (!m || !d || d > 31) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "14.973" -> "14973"; keeps a reissue suffix such as "2.200-2" -> "2200-2". */
export function bareNumber(n: string): string {
  return n.replace(/\./g, "").replace(/^0+(?=\d)/, "");
}

/** Collapses whitespace and decodes the handful of HTML entities that appear in DOU pages. */
export function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ordm: "º", ordf: "ª", deg: "°" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return named[code.toLowerCase()] ?? all;
  });
}

/**
 * A short card title from an ementa: its first clause, cut at a word boundary.
 * The full ementa stays in `summary`.
 */
export function shortTitle(ementa: string, max = 90): string {
  const first = ementa.split(/(?<=[.;])\s|,?\s+e\s+d[áa]\s+outras\s+provid[êe]ncias/i)[0].replace(/[.;,]\s*$/, "").trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/** Caps a summary at `max` chars on a word boundary. */
export function capSummary(s: string, max = 400): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** YYYY-MM-DD in UTC, `days` before `from`. */
export function daysAgo(days: number, from = new Date()): string {
  const d = new Date(from.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Every YYYY-MM-DD from `since` to `until`, inclusive. */
export function dateRange(since: string, until: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${since}T00:00:00Z`); t <= Date.parse(`${until}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
