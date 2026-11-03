// Nightly open-data dump: every law in Postgres as JSON and CSV, gzipped.
//   DATABASE_URL=... npm run db:export [-- out-dir]      (default dist/dados)
// Writes leis.json.gz (the same records the site uses, one array sorted by id) and leis.csv.gz
// (one row per law; lists joined with " | "). The nightly workflow publishes both on the "dados" release.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { closeDb, getDb } from "../lib/db/client.ts";
import { fromDbRow } from "../lib/db/codec.ts";
import { policies, policyColumns } from "../lib/db/schema.ts";
import { toCsv } from "../lib/db/export.ts";

const outDir = path.resolve(process.argv[2] ?? "dist/dados");
const rows = await getDb().select(policyColumns).from(policies).orderBy(policies.id);
await closeDb();
const records = rows.map(fromDbRow);
if (!records.length) throw new Error("no records in the database; refusing to publish an empty dump");

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "leis.json.gz"), gzipSync(JSON.stringify(records)));
await writeFile(path.join(outDir, "leis.csv.gz"), gzipSync(toCsv(records)));
console.log(`exported ${records.length} records to ${outDir}`);
