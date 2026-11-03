import { getDb } from "@/lib/db/client";
import { latestRuns } from "@/lib/db/runs";

// The latest run of each crawler, for the "Fontes" cards. Cached for a minute, so the home can poll it
// and the database sees at most one query a minute however many people are looking.
export const revalidate = 60;

export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ runs: [], updatedAt: new Date().toISOString() });
  try {
    return Response.json({ runs: await latestRuns(getDb()), updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("coletas:", err);
    return Response.json({ runs: [], error: "unavailable" }, { status: 503 });
  }
}
