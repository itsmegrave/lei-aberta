import { test } from "node:test";
import assert from "node:assert/strict";
import { sinceDay, sinceYear } from "./cursor.ts";

const now = new Date("2026-10-31T06:30:00Z");

test("sinceDay starts the overlap before the cursor, within the min/max window", () => {
  // Normal night: cursor yesterday, one day overlap, but never less than 3 days back.
  assert.equal(sinceDay("2026-10-30T06:30:00Z", { overlapDays: 1, minDays: 3, maxDays: 30, now }), "2026-10-28");
  // Missed a week: catch up from the day before the last good run.
  assert.equal(sinceDay("2026-10-20T06:30:00Z", { overlapDays: 1, minDays: 3, maxDays: 30, now }), "2026-10-19");
  // Broken for months: capped at maxDays.
  assert.equal(sinceDay("2026-01-01T00:00:00Z", { overlapDays: 1, minDays: 3, maxDays: 30, now }), "2026-10-01");
  // Never ran, or an unreadable cursor: minDays back.
  assert.equal(sinceDay(null, { minDays: 7, now }), "2026-10-24");
  assert.equal(sinceDay("garbage", { minDays: 7, now }), "2026-10-24");
});

test("sinceYear reaches into last year only when the overlap crosses New Year", () => {
  assert.equal(sinceYear("2026-10-30T06:30:00Z", { overlapDays: 7, maxDays: 400, now }), 2026);
  assert.equal(sinceYear("2026-01-03T06:30:00Z", { overlapDays: 7, maxDays: 400, now: new Date("2026-01-04T06:30:00Z") }), 2025);
});
