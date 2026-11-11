// Fills data/ with the catalog: <level>/<year>.json, index.json and status/ from the `data` branch, plus ids.json
// (every law id, for short links). The Vercel build runs it before `next build`; run it locally for the full catalog.
//   npm run data:pull                      # data branch, or the latest open-data dump if there is no branch yet
//   npm run data:pull -- --from-dump DIR   # the dump only, into DIR (seeds a new data branch)
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";
import { openStore } from "../crawlers/lib/store.ts";
import { DATA_BRANCH_TARBALL, DUMP_URL } from "../lib/data-branch.ts";
import type { Policy } from "../lib/types.ts";

const args = process.argv.slice(2);
const fromDump = args.includes("--from-dump");
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "data");
await mkdir(dir, { recursive: true });

if (fromDump) await pullDump();
else {
  if (!(await pullBranch())) await pullDump();
  await writeIds();
}

/** Unpacks the data branch's tarball into dir. False when the branch doesn't exist yet. */
async function pullBranch(): Promise<boolean> {
  const res = await fetch(DATA_BRANCH_TARBALL);
  if (res.status === 404) {
    console.warn("no data branch yet; using the open-data dump");
    return false;
  }
  if (!res.ok || !res.body) throw new Error(`${DATA_BRANCH_TARBALL}: HTTP ${res.status}`);
  // The branch's own README and vercel.json stay out of data/.
  const tar = spawn("tar", ["-xz", "-C", dir, "--strip-components=1", "--wildcards", "--exclude=*/README.md", "--exclude=*/vercel.json"], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(tar.stdin);
  const code = await new Promise<number | null>((resolve, reject) => tar.on("error", reject).on("close", resolve));
  if (code !== 0) throw new Error(`tar exited with ${code}`);
  console.log(`data branch unpacked into ${dir}`);
  return true;
}

async function pullDump(): Promise<void> {
  const res = await fetch(DUMP_URL);
  if (!res.ok) throw new Error(`${DUMP_URL}: HTTP ${res.status}`);
  const records = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as Policy[];
  const store = await openStore(dir);
  for (const r of records) store.upsert(r, { owner: true });
  console.log(`${records.length} records from the dump, ${await store.save()} files written to ${dir}`);
}

/** ids.json: every id, so short links resolve without reading the whole catalog. */
async function writeIds(): Promise<void> {
  const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8")) as { files: { path: string }[] };
  const ids: string[] = [];
  for (const f of index.files) for (const p of JSON.parse(await readFile(path.join(dir, f.path), "utf8")) as Policy[]) ids.push(p.id);
  await writeFile(path.join(dir, "ids.json"), JSON.stringify(ids.sort()) + "\n");
  console.log(`${ids.length} laws in ${dir}`);
}
