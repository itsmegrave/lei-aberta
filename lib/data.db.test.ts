// The Postgres path of lib/data.ts: what the site reads when DATABASE_URL is set (Vercel, CI).
// Runs only with TEST_DATABASE_URL (see lib/db/upsert.db.test.ts), and points DATABASE_URL at it for this process.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { like } from "drizzle-orm";
import { closeDb, getDb } from "./db/client.ts";
import { policies } from "./db/schema.ts";
import { upsertPolicies } from "./db/upsert.ts";
import type { Policy } from "./types.ts";

const PREFIX = "test-db-data-";
const law = (n: number, over: Partial<Policy> = {}): Policy => {
  const p: Policy = {
  id: `${PREFIX}${n}`, level: "estadual", jurisdiction: "SP", type: "lei", number: String(n), title: `Lei de teste ${n}`,
  summary: "Resumo.", year: 2099, presentedAt: "2099-01-02", signedAt: "2099-03-04", status: "sancionada", areas: ["educacao"],
  authors: [{ name: "Fulana", kind: "state-deputy", party: "PSOL", uf: "SP" }], parties: ["PSOL"],
  executive: { name: "Governador", office: "Governador", party: "PSDB" }, sources: [{ label: "Alesp", url: "https://www.al.sp.gov.br/x" }],
  ...over,
  };
  // Optional fields left out entirely, as fromDbRow returns them.
  for (const k of Object.keys(p) as (keyof Policy)[]) if (p[k] === undefined) delete p[k];
  return p;
};

describe("lib/data.ts reading Postgres", { skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not set" }, () => {
  let data: typeof import("./data.ts");
  const clean = () => getDb().delete(policies).where(like(policies.id, `${PREFIX}%`));

  before(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    getDb(process.env.TEST_DATABASE_URL);
    await clean();
    await upsertPolicies(getDb(), [law(1, { title: "B" }), law(2, { title: "A" }), law(3, { year: 2098, number: undefined, curated: true })]);
    data = await import("./data.ts");
  });
  after(async () => {
    await clean();
    await closeDb();
  });

  test("findPolicy returns one law exactly as stored, or undefined", async () => {
    assert.deepEqual(await data.findPolicy(`${PREFIX}1`), law(1, { title: "B" }));
    assert.deepEqual(await data.findPolicy(`${PREFIX}3`), law(3, { year: 2098, number: undefined, curated: true }));
    assert.equal(await data.findPolicy(`${PREFIX}404`), undefined);
  });

  test("policyIds lists every id in the table", async () => {
    const ids = await data.policyIds();
    for (const n of [1, 2, 3]) assert.ok(ids.includes(`${PREFIX}${n}`));
    assert.equal(new Set(ids).size, ids.length);
  });

  test("the catalog is newest first, then by title, with the last update time", async () => {
    const { policies: list, updatedAt, sample } = await data.loadCatalog();
    assert.deepEqual(list.slice(0, 3).map((p) => p.id), [`${PREFIX}2`, `${PREFIX}1`, `${PREFIX}3`]);
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].year >= list[i].year, `order at ${i}`);
    assert.equal(sample, false);
    assert.ok(Date.now() - Date.parse(updatedAt) < 10 * 60_000, updatedAt);
    // Rows come back without the search vector.
    assert.equal("search" in list[0], false);
  });
});
