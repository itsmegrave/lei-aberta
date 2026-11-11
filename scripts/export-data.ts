// Daily open-data dump: every law in a catalog folder as JSON and CSV, gzipped.
//   npm run data:export [-- data-dir out-dir]      (defaults: data, dist/dados)
// Writes leis.json.gz (the same records the site uses, one array sorted by id) and leis.csv.gz
// (one row per law; lists joined with " | "). export-data.yml publishes both on the "dados" release.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { openStore } from "../crawlers/lib/store.ts";
import { toCsv } from "../lib/export.ts";

const [dataDir = "data", outDir = "dist/dados"] = process.argv.slice(2).map((p) => path.resolve(p));
const records = (await openStore(dataDir)).all().sort((a, b) => a.id.localeCompare(b.id));
if (!records.length) throw new Error(`no records in ${dataDir}; refusing to publish an empty dump`);

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "leis.json.gz"), gzipSync(JSON.stringify(records)));
await writeFile(path.join(outDir, "leis.csv.gz"), gzipSync(toCsv(records)));
console.log(`exported ${records.length} records to ${outDir}`);
