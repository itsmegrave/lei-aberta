import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./export.ts";
import type { Policy } from "./types.ts";

const p: Policy = {
  id: "federal-lei-1-2000", level: "federal", jurisdiction: "Brasil", type: "lei", number: "1", title: 'Lei "um", com vírgula',
  summary: "Linha 1\nlinha 2", year: 2000, presentedAt: null, signedAt: "2000-01-02", status: "sancionada", areas: ["saude", "educacao"],
  authors: [{ name: "Fulano", kind: "deputy", party: "AAA", uf: "SP" }, { name: "Poder Executivo", kind: "executive", party: null, uf: null }],
  parties: ["AAA"], executive: { name: "X", office: "Presidente", party: "BBB" },
  sources: [{ label: "Senado", url: "https://legis.senado.leg.br/x" }],
};

test("csv has a header and quotes cells with commas, quotes and newlines", () => {
  const [head, ...rest] = toCsv([p]).trimEnd().split("\n");
  assert.ok(head.startsWith("id,nivel,jurisdicao,tipo,numero,titulo,resumo,ano,"));
  const row = rest.join("\n");
  assert.ok(row.includes('"Lei ""um"", com vírgula"'));
  assert.ok(row.includes('"Linha 1\nlinha 2"'));
  assert.ok(row.includes("saude | educacao"));
  assert.ok(row.includes("Fulano / AAA / SP | Poder Executivo"));
});

/** Minimal RFC 4180 reader, enough to check the writer. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") rows.at(-1)!.push(cell), (cell = "");
    else if (c === "\n") rows.at(-1)!.push(cell), (cell = ""), rows.push([]);
    else cell += c;
  }
  return rows.filter((r) => r.length > 1);
}

test("author parties and the executive's party stay in separate columns", () => {
  const [cols, values] = parseCsv(toCsv([p]));
  assert.equal(values.length, cols.length);
  assert.equal(values[cols.indexOf("titulo")], 'Lei "um", com vírgula');
  assert.equal(values[cols.indexOf("partidos_autores")], "AAA");
  assert.equal(values[cols.indexOf("executivo_partido")], "BBB");
});
