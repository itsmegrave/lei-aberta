// Checks that every source link of the hand-written (curated) records answers and names the right law.
//   npm run check:links            (prints a report; exits 1 if a link is broken)
import { openStore } from "../lib/store.ts";

const store = await openStore("data");
const rows = store.all().filter((r) => r.curated);
let broken = 0;
for (const r of rows)
  for (const s of r.sources) {
    let note: string;
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "LeiAberta/0.1 link check" }, signal: AbortSignal.timeout(30_000) });
      const body = res.ok ? new TextDecoder("latin1").decode(await res.arrayBuffer()) : "";
      const num = (r.number ?? "").replace(/\./g, "");
      const named = body.replace(/\./g, "").includes(num);
      note = `${res.status}${res.ok ? (named ? " ok" : " (law number not found in page)") : ""}`;
      if (!res.ok || !named) broken++;
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      note = `error: ${(e as Error).message}${cause ? ` (${cause.code ?? ""} ${cause.message ?? ""})` : ""}`;
      broken++;
    }
    console.log(`${r.id}\t${note}\t${s.url}`);
  }
console.log(`${rows.length} curated records, ${broken} problem link(s).`);
if (broken) process.exitCode = 1;
