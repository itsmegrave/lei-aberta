import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDbRow, toDbRow } from "./codec.ts";
import type { PolicyRow } from "./schema.ts";
import type { Policy } from "../types.ts";

const p: Policy = {
  id: "federal-lei-1-2000", level: "federal", jurisdiction: "Brasil", type: "lei", number: "1", title: "Lei 1",
  summary: "Resumo.", year: 2000, presentedAt: "1999-05-01", signedAt: "2000-01-02", status: "sancionada", areas: ["saude"],
  authors: [{ name: "Fulano", kind: "deputy", party: "AAA", uf: "SP" }], parties: ["AAA"],
  executive: { name: "X", office: "Presidente", party: "BBB" },
  sources: [{ label: "Senado", url: "https://legis.senado.leg.br/x" }],
};

const asRow = (r: ReturnType<typeof toDbRow>) => ({ ...r, updatedAt: new Date(), search: "" }) as PolicyRow;

test("round trips a record through a row", () => {
  assert.deepEqual(fromDbRow(asRow(toDbRow(p))), p);
});

test("keeps the executive's party in its own column, apart from author parties", () => {
  const row = toDbRow(p);
  assert.equal(row.executiveParty, "BBB");
  assert.deepEqual(row.parties, ["AAA"]);
});

test("leaves empty optional fields out", () => {
  const out = fromDbRow(asRow(toDbRow({ ...p, number: undefined, bill: null, curated: false, executive: null })));
  assert.equal("number" in out, false);
  assert.equal("bill" in out, false);
  assert.equal("curated" in out, false);
  assert.equal(out.executive, null);
});
