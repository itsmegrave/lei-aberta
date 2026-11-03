// Downloads the latest open-data dump and unpacks it into data/<level>/<year>.json + data/index.json,
// so the site can run locally with the full catalog and no database.
//   npm run data:pull
import { gunzipSync } from "node:zlib";
import { openStore } from "../crawlers/lib/store.ts";
import type { Policy } from "../lib/types.ts";

const URL_DUMP = "https://github.com/itsmegrave/lei-aberta/releases/download/dados/leis.json.gz";
const res = await fetch(URL_DUMP);
if (!res.ok) throw new Error(`${URL_DUMP}: HTTP ${res.status}`);
const records = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as Policy[];
// File store on purpose, even if CRAWL_DATABASE_URL is set in this shell.
const store = await openStore("data", { databaseUrl: "" });
for (const r of records) store.upsert(r, { owner: true });
console.log(`${records.length} records, ${await store.save()} files written to data/`);
