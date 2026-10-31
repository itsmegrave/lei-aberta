// Integration tests against a real, migrated Postgres. They run only when TEST_DATABASE_URL is set (CI sets it
// after migrating a throwaway database), never against DATABASE_URL, so a local npm test can't touch a real database.
// They only write ids starting with "test-db-" and delete them afterwards.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, like, sql } from "drizzle-orm";
import type { Policy } from "../types.ts";
import { closeDb, getDb, type Db } from "./client.ts";
import { fromDbRow } from "./codec.ts";
import { policies } from "./schema.ts";
import { upsertPolicies } from "./upsert.ts";

const PREFIX = "test-db-";
const law = (n: number, over: Partial<Policy> = {}): Policy => ({
  id: `${PREFIX}${n}`, level: "federal", jurisdiction: "Brasil", type: "lei", number: String(n), title: `Lei de saneamento ${n}`,
  summary: "Regras para água e esgoto.", year: 2020, presentedAt: null, signedAt: "2020-07-15", status: "sancionada", areas: ["saneamento"],
  authors: [{ name: "Fulana", kind: "deputy", party: "PT", uf: "SP" }], parties: ["PT"],
  executive: { name: "Beltrano", office: "Presidente", party: "PSL" }, sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/x" }],
  ...over,
});

describe("Postgres upsert", { skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not set" }, () => {
  let db: Db;
  const clean = () => db.delete(policies).where(like(policies.id, `${PREFIX}%`));
  const read = async (id: string) => (await db.select().from(policies).where(eq(policies.id, id)))[0];

  before(async () => {
    db = getDb(process.env.TEST_DATABASE_URL);
    await clean();
  });
  after(async () => {
    await clean();
    await closeDb();
  });

  test("inserts a record and reads it back unchanged", async () => {
    assert.equal(await upsertPolicies(db, [law(1)]), 1);
    assert.deepEqual(fromDbRow(await read(`${PREFIX}1`)), law(1));
  });

  test("a second upsert of the same id updates it in place and bumps updated_at", async () => {
    const before = (await read(`${PREFIX}1`)).updatedAt;
    await new Promise((r) => setTimeout(r, 20));
    await upsertPolicies(db, [law(1, { title: "Novo título", status: "revogada", executive: null })]);
    const row = await read(`${PREFIX}1`);
    assert.equal(row.title, "Novo título");
    assert.equal(row.status, "revogada");
    assert.equal(row.executive, null);
    assert.equal(row.executiveParty, null);
    assert.ok(row.updatedAt > before);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(policies).where(like(policies.id, `${PREFIX}1`));
    assert.equal(n, 1);
  });

  test("large imports go in batches", async () => {
    const many = Array.from({ length: 1203 }, (_, i) => law(i, { id: `${PREFIX}batch-${i}` }));
    assert.equal(await upsertPolicies(db, many), 1203);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(policies).where(like(policies.id, `${PREFIX}batch-%`));
    assert.equal(n, 1203);
  });

  test("the executive's party has its own column, apart from author parties", async () => {
    await upsertPolicies(db, [law(2)]);
    const row = await read(`${PREFIX}2`);
    assert.equal(row.executiveParty, "PSL");
    assert.deepEqual(row.parties, ["PT"]);
  });

  test("a record without an official source is rejected", async () => {
    await assert.rejects(upsertPolicies(db, [law(3, { sources: [] })]));
    assert.equal(await read(`${PREFIX}3`), undefined);
  });

  test("Portuguese full-text search finds title and summary words", async () => {
    await upsertPolicies(db, [law(4)]);
    const hit = await db
      .select({ id: policies.id })
      .from(policies)
      .where(sql`${policies.id} = ${`${PREFIX}4`} and ${policies.search} @@ plainto_tsquery('portuguese', 'esgotos')`);
    assert.equal(hit.length, 1);
  });
});
