import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTY_SCORES, partyScore, spectrumColor, SPECTRUM_STOPS } from "./party-spectrum.ts";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("scores stay on the survey's 0-10 scale", () => {
  for (const [party, s] of Object.entries(PARTY_SCORES)) assert.ok(s >= 0 && s <= 10, party);
});

test("every surveyed party scores as itself, in any case", () => {
  for (const [party, s] of Object.entries(PARTY_SCORES)) {
    assert.equal(partyScore(party), s, party);
    assert.equal(partyScore(party.toLowerCase()), s, party.toLowerCase());
  }
});

test("missing or unknown parties have no position", () => {
  assert.equal(partyScore(null), null);
  assert.equal(partyScore(undefined), null);
  assert.equal(partyScore(""), null);
  assert.equal(partyScore("Partido Inventado"), null);
});

test("colors are hex and every unknown party gets the theme's gray", () => {
  for (const mode of ["light", "dark"] as const) {
    assert.equal(spectrumColor(null, mode), SPECTRUM_STOPS[mode].none);
    for (let s = 0; s <= 10; s += 0.5) assert.match(spectrumColor(s, mode), /^#[0-9a-f]{6}$/);
  }
  assert.equal(spectrumColor(null), SPECTRUM_STOPS.light.none);
});

test("out-of-range scores clamp to the poles", () => {
  assert.equal(spectrumColor(-3), spectrumColor(0));
  assert.equal(spectrumColor(42), spectrumColor(10));
});

test("left reads red, right reads blue, and the hue moves steadily between them", () => {
  let prev = -Infinity;
  for (let s = 0; s <= 10; s += 0.25) {
    const [r, , b] = rgb(spectrumColor(s));
    const lean = b - r; // negative on the left, positive on the right
    assert.ok(lean >= prev - 1, `blue-red balance should not go back at ${s}`);
    prev = lean;
  }
  const [lr, , lb] = rgb(spectrumColor(PARTY_SCORES.PSOL));
  const [rr, , rb] = rgb(spectrumColor(PARTY_SCORES.DEM));
  assert.ok(lr > lb, "PSOL is red");
  assert.ok(rb > rr, "DEM is blue");
});

test("near-center parties still lean visibly off the gray midpoint", () => {
  const mid = rgb(spectrumColor(5));
  const near = rgb(spectrumColor(5.5));
  assert.ok(near[2] - near[0] - (mid[2] - mid[0]) > 15);
});
