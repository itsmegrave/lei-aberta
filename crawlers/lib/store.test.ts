import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mergeRecord, openStore, validate } from "./store.ts";
import type { Policy } from "../../lib/types.ts";

const rec: Policy = {
  id: "federal-lei-1-2000", level: "federal", jurisdiction: "Brasil", type: "lei", number: "1", title: "Lei 1",
  summary: "Texto escrito à mão.", year: 2000, presentedAt: null, status: "sancionada", areas: ["saude"],
  authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }], parties: [],
  executive: { name: "X", office: "Presidente", party: "AAA" },
  sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/a.htm" }],
};

test("owner overwrites fields but keeps preserved ones and the union of sources", () => {
  const incoming = { ...rec, summary: "Ementa oficial.", status: "revogada", sources: [{ label: "Senado", url: "https://legis.senado.leg.br/x" }] };
  const out = mergeRecord(rec, incoming, { owner: true, preserve: ["summary"] });
  assert.equal(out.summary, "Texto escrito à mão.");
  assert.equal(out.status, "revogada");
  assert.deepEqual(out.sources.map((s) => s.label), ["Senado", "Planalto"]);
});

test("non-owner only fills gaps and appends sources", () => {
  const incoming = { ...rec, title: "Outro", presentedAt: "1999-01-01", sources: [{ label: "DOU", url: "https://www.in.gov.br/x" }, { label: "dup", url: "http://www.planalto.gov.br/a.htm" }] };
  const out = mergeRecord(rec, incoming, { owner: false });
  assert.equal(out.title, "Lei 1");
  assert.equal(out.presentedAt, "1999-01-01");
  assert.deepEqual(out.sources.map((s) => s.label), ["Planalto", "DOU"]);
});

test("validate requires an official https source and no party on executive authors", () => {
  assert.deepEqual(validate(rec), []);
  assert.ok(validate({ ...rec, sources: [{ label: "x", url: "https://example.com" }] }).length);
  assert.ok(validate({ ...rec, authors: [{ name: "Poder Executivo", kind: "executive", party: "PT", uf: null }] }).length);
});

test("save writes year files and index", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "store-"));
  const s = await openStore(dir);
  s.upsert(rec, { owner: true });
  s.upsert({ ...rec, id: "federal-lei-2-2001", year: 2001 }, { owner: true });
  await s.save();
  const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  assert.deepEqual(index.files.map((f: { path: string }) => f.path), ["federal/2000.json", "federal/2001.json"]);
  const again = await openStore(dir);
  assert.equal(again.all().length, 2);
});
