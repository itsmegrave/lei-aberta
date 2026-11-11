// CSV for the open-data dump: one row per law, lists joined with " | ".
import type { Policy } from "./types.ts";

const COLUMNS: [string, (p: Policy) => unknown][] = [
  ["id", (p) => p.id],
  ["nivel", (p) => p.level],
  ["jurisdicao", (p) => p.jurisdiction],
  ["tipo", (p) => p.type],
  ["numero", (p) => p.number],
  ["titulo", (p) => p.title],
  ["resumo", (p) => p.summary],
  ["ano", (p) => p.year],
  ["apresentada_em", (p) => p.presentedAt],
  ["assinada_em", (p) => p.signedAt],
  ["situacao", (p) => p.status],
  ["temas", (p) => p.areas.join(" | ")],
  // Author parties at authorship. The executive's party is its own column and never merged into this one.
  ["partidos_autores", (p) => p.parties.join(" | ")],
  ["autores", (p) => p.authors.map((a) => [a.name, a.party, a.uf].filter(Boolean).join(" / ")).join(" | ")],
  ["executivo", (p) => p.executive?.name],
  ["executivo_cargo", (p) => p.executive?.office],
  ["executivo_partido", (p) => p.executive?.party],
  ["projeto", (p) => p.bill],
  ["convertida_em", (p) => p.convertedInto],
  ["fontes", (p) => p.sources.map((s) => s.url).join(" | ")],
];

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(records: Policy[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(",")];
  for (const p of records) lines.push(COLUMNS.map(([, get]) => cell(get(p))).join(","));
  return lines.join("\n") + "\n";
}
