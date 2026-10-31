import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, area, emojiSrc, fmt, lawLabel, LEVELS, plural, statusLabel, typeLabel } from "./vocab.ts";

test("every topic has a label, a tint and an emoji; unknown topics fall back", () => {
  for (const [key, a] of Object.entries(AREAS)) {
    assert.ok(a.label && a.tint && a.emoji, key);
    assert.deepEqual(area(key), a);
  }
  assert.deepEqual(area("astronomia"), { label: "astronomia", tint: "gov", emoji: "scroll" });
});

test("levels are federal, estadual, municipal in that order", () => {
  assert.deepEqual(LEVELS.map((l) => l.key), ["federal", "estadual", "municipal"]);
});

test("law labels are short by default and long on request", () => {
  assert.equal(lawLabel({ type: "lei", number: "14.026" }), "Lei 14.026");
  assert.equal(lawLabel({ type: "medida-provisoria", number: "2.200-2" }), "MP 2.200-2");
  assert.equal(lawLabel({ type: "medida-provisoria", number: "2.200-2" }, true), "Medida Provisória 2.200-2");
  assert.equal(lawLabel({ type: "lei-complementar", number: "101" }), "Lei Compl. 101");
  assert.equal(lawLabel({ type: "lei complementar", number: "101" }, true), "Lei Complementar 101");
  assert.equal(lawLabel({ type: "lei" }), "Lei");
  assert.equal(typeLabel("decreto"), "decreto");
});

test("status labels, with unknown codes passed through", () => {
  assert.equal(statusLabel("perdeu-eficacia"), "Perdeu a validade");
  assert.equal(statusLabel("vetada"), "vetada");
});

test("numbers read in pt-BR, with lei/leis", () => {
  assert.equal(fmt.format(12345), "12.345");
  assert.equal(plural(0), "0 leis");
  assert.equal(plural(1), "1 lei");
  assert.equal(plural(1500), "1.500 leis");
  assert.equal(emojiSrc("books"), "/emoji/books.webp");
});
