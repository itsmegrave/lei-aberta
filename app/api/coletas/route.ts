import path from "node:path";
import { readFile } from "node:fs/promises";
import { toRuns } from "@/lib/crawl-runs-store";
import { stateOf } from "@/lib/sources";
import { DATA_BRANCH_RAW } from "@/lib/data-branch";

// The latest run of each crawler and the crawl state of each source, for the "Fontes" cards. The crawl jobs
// commit both to the data branch while they run, so this reads them from GitHub rather than from the build.
// Cached for a minute, so the home can poll it and GitHub sees at most a couple of requests a minute.
export const revalidate = 60;

async function readStatus(name: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${DATA_BRANCH_RAW}/status/${name}`, { next: { revalidate: 60 } });
    if (res.ok) return await res.json();
    if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`coletas: ${name}:`, err);
  }
  // No data branch yet, or GitHub is unreachable: the copy pulled at build time, if any.
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "data", "status", name), "utf8"));
  } catch {
    return {};
  }
}

export async function GET() {
  const updatedAt = new Date().toISOString();
  const [runs, sources] = await Promise.all([readStatus("runs.json"), readStatus("sources.json")]);
  return Response.json({
    runs: toRuns(runs as Parameters<typeof toRuns>[0]),
    sources: Object.fromEntries(Object.entries(sources).map(([id, s]) => [id, stateOf(s as object)])),
    updatedAt,
  });
}
