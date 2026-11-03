import { getDb } from "@/lib/db/client";
import { latestRuns } from "@/lib/db/runs";
import { readSourceStates } from "@/lib/db/source-status";

// The latest run of each crawler and the crawl state of each source, for the "Fontes" cards. Cached for a
// minute, so the home can poll it and the database sees at most a couple of queries a minute.
export const revalidate = 60;

export async function GET() {
  const updatedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) return Response.json({ runs: [], sources: {}, updatedAt });
  try {
    const db = getDb();
    const [runs, sources] = await Promise.all([latestRuns(db), readSourceStates(db)]);
    return Response.json({ runs, sources, updatedAt });
  } catch (err) {
    console.error("coletas:", err);
    return Response.json({ runs: [], sources: {}, error: "unavailable" }, { status: 503 });
  }
}
