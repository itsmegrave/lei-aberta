// One-off: loads every record in data/ (index.json plus the per-level, per-year files) into Postgres.
// Idempotent: rerunning updates rows in place. Refuses to run if any record fails validation.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb } from "../lib/db/client.ts";
import { upsertPolicies } from "../lib/db/upsert.ts";
import type { Policy } from "../lib/types.ts";
import { validate } from "../crawlers/lib/store.ts";

const dataDir = path.resolve(process.argv[2] ?? "data");
const index = JSON.parse(await readFile(path.join(dataDir, "index.json"), "utf8")) as { files: { path: string }[] };
const records: Policy[] = [];
for (const f of index.files) records.push(...(JSON.parse(await readFile(path.join(dataDir, f.path), "utf8")) as Policy[]));

const bad = records.flatMap((p) => validate(p).map((e) => `${p.id}: ${e}`));
if (bad.length) {
  console.error(`${bad.length} invalid records, nothing imported:\n${bad.slice(0, 20).join("\n")}`);
  process.exit(1);
}

const db = getDb();
const t = Date.now();
const n = await upsertPolicies(db, records);
const [{ count }] = await db.$client`select count(*)::int as count from policies`;
await closeDb();
console.log(`upserted ${n} records from ${index.files.length} files in ${((Date.now() - t) / 1000).toFixed(1)}s; table now has ${count}`);
