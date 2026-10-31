// Needs a Postgres: run with TEST_DATABASE_URL set (npm run test:db; CI does).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "./store.ts";
import type { Policy } from "../../lib/types.ts";

const rec: Policy = {
  id: "x", level: "federal", jurisdiction: "Brasil", type: "lei", number: "1", title: "Lei de teste",
  summary: "Resumo.", year: 2000, presentedAt: null, status: "sancionada", areas: ["saude"],
  authors: [{ name: "Poder Executivo", kind: "executive", party: null, uf: null }], parties: [],
  executive: { name: "X", office: "Presidente", party: "AAA" },
  sources: [{ label: "Planalto", url: "https://www.planalto.gov.br/a.htm" }],
};

const testDb = process.env.TEST_DATABASE_URL;
test("save mirrors changed and removed records into Postgres", { skip: !testDb && "TEST_DATABASE_URL not set" }, async () => {
  const { getDb, closeDb } = await import("../../lib/db/client.ts");
  const dir = await mkdtemp(path.join(tmpdir(), "store-db-"));
  const ids = ["test-db-store-1", "test-db-store-2"];
  const store = await openStore(dir, { databaseUrl: testDb });
  for (const id of ids) store.upsert({ ...rec, id, number: id }, { owner: true });
  await store.save();
  let db = getDb(testDb);
  let rows = await db.$client`select id from policies where id in ${db.$client(ids)} order by id`;
  assert.deepEqual(rows.map((r) => r.id), ids);
  await closeDb();

  store.remove(ids[1]);
  store.upsert({ ...rec, id: ids[0], number: ids[0], status: "revogada" }, { owner: true });
  await store.save();
  db = getDb(testDb);
  rows = await db.$client`select id, status from policies where id in ${db.$client(ids)}`;
  assert.deepEqual(rows.map((r) => [r.id, r.status]), [[ids[0], "revogada"]]);
  await db.$client`delete from policies where id in ${db.$client(ids)}`;
  await closeDb();
});
