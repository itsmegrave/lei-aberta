import { test } from "node:test";
import assert from "node:assert/strict";
import { lawPlace } from "./law-place.ts";

const names = { SP: "São Paulo", AL: "Alagoas", MG: "Minas Gerais", PB: "Paraíba" };
const author = (uf: string | null) => ({ name: "A", kind: "deputy", party: "PT", uf });

test("a federal law covers the country and lists its authors' states once", () => {
  const p = lawPlace({ id: "federal-lei-1-1990", level: "federal", jurisdiction: "Brasil", authors: [author("SP"), author("sp"), author("MG"), author(null), author("XX")] }, names);
  assert.deepEqual(p, { scope: "country", uf: null, authorUfs: ["SP", "MG"], text: "Lei federal: vale em todo o Brasil." });
});

test("a state law takes its state from the id, or from the name", () => {
  assert.equal(lawPlace({ id: "estadual-al-lei-1-2020", level: "estadual", jurisdiction: "Alagoas", authors: [] }, names).uf, "AL");
  const byName = lawPlace({ id: "x", level: "estadual", jurisdiction: "paraiba", authors: [author("SP")] }, names);
  assert.deepEqual(byName, { scope: "state", uf: "PB", authorUfs: [], text: "Lei estadual: vale em Paraíba." });
});

test("a municipal law highlights the city's state and names the city", () => {
  const p = lawPlace({ id: "municipal-x", level: "municipal", jurisdiction: "Campinas (SP)", authors: [] }, names);
  assert.deepEqual(p, { scope: "state", uf: "SP", authorUfs: [], text: "Lei municipal: vale em Campinas, São Paulo." });
});

test("an unknown place keeps the jurisdiction text and highlights nothing", () => {
  const p = lawPlace({ id: "municipal-x", level: "municipal", jurisdiction: "Lugar", authors: [] }, names);
  assert.deepEqual(p, { scope: "state", uf: null, authorUfs: [], text: "Lei municipal: vale em Lugar." });
});
