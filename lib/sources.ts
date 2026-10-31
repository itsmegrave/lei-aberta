/**
 * Data source manifest. Each crawler owns one file, data/sources/<id>.json, and rewrites it on every run.
 * One file per source means crawlers never edit the same file. The site lists every file at build time.
 */
export type SourceStatus = "active" | "building" | "planned" | "failing";
export type SourceLevel = "federal" | "estadual" | "municipal";

export interface DataSource {
  /** kebab-case; must equal the file name without .json */
  id: string;
  /** Short name shown on the site, in Portuguese. */
  name: string;
  /** Institution that publishes the data. */
  publisher: string;
  /** Official home page or API docs. Must be https. */
  url: string;
  levels: SourceLevel[];
  /** Where it applies, in Portuguese: ["Brasil"], ["SP", "RJ"], ["Municípios do Querido Diário"]. */
  coverage: string[];
  /** Record types it brings, in Portuguese: "lei", "lei complementar", "medida provisória", "decreto". */
  covers: string[];
  /** One plain sentence in Portuguese: what this source adds. */
  description: string;
  status: SourceStatus;
  /** First year covered, if known. */
  since?: number | null;
  /** Records in data/ that came from this source after the last successful run. */
  records?: number | null;
  /** ISO timestamps. lastRun is any attempt; lastSuccess is the last run that wrote data. */
  lastRun?: string | null;
  lastSuccess?: string | null;
  /** Repo path of the crawler, e.g. "crawlers/federal/run.ts". */
  crawler?: string | null;
}

export const STATUS_LABEL: Record<SourceStatus, string> = {
  active: "Coletando",
  building: "Em construção",
  planned: "Planejada",
  failing: "Com falha",
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Returns a list of problems; empty means valid. `file` is the file name, used to check the id. */
export function validateSource(s: DataSource, file?: string): string[] {
  const e: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id ?? "")) e.push("id must be kebab-case");
  if (file && file !== `${s.id}.json`) e.push(`file name must be ${s.id}.json`);
  for (const k of ["name", "publisher", "description"] as const) if (!s[k]?.trim()) e.push(`${k} is required`);
  if (!/^https:\/\//.test(s.url ?? "")) e.push("url must be https");
  if (!s.levels?.length || s.levels.some((l) => !["federal", "estadual", "municipal"].includes(l))) e.push("levels must be federal/estadual/municipal");
  if (!s.coverage?.length) e.push("coverage is required");
  if (!s.covers?.length) e.push("covers is required");
  if (!(s.status in STATUS_LABEL)) e.push("status must be active/building/planned/failing");
  for (const k of ["lastRun", "lastSuccess"] as const) if (s[k] != null && !ISO.test(s[k]!)) e.push(`${k} must be an ISO timestamp`);
  if (s.status === "active" && !s.lastSuccess) e.push("active sources need lastSuccess");
  return e;
}

/** Order on the site: active first, then building, failing, planned; then by name. */
export function sortSources(list: DataSource[]): DataSource[] {
  const rank: Record<SourceStatus, number> = { active: 0, building: 1, failing: 2, planned: 3 };
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, "pt"));
}

/** "há 3 horas", "há 2 dias": short relative time in Portuguese. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 86400 * 45) return rtf.format(-Math.round(s / 86400), "day");
  return rtf.format(-Math.round(s / (86400 * 30)), "month");
}
