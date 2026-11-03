// Records a crawl in Postgres so the site can show it live. Called by the crawl workflows:
//   node scripts/crawl-run.ts start crawlers/federal/run.ts
//   node scripts/crawl-run.ts finish crawlers/federal/run.ts <steps.crawl.outcome>
// Uses CRAWL_DATABASE_URL, like the crawler store. Status is a nicety: any problem here is logged and never fails the job.
import { outcomeStatus, runId, runUrl } from "../lib/crawl-runs.ts";
import { closeDb, getDb } from "../lib/db/client.ts";
import { finishRun, startRun } from "../lib/db/runs.ts";

const [action, crawler, outcome = "success"] = process.argv.slice(2);
const url = process.env.CRAWL_DATABASE_URL;
const id = crawler ? runId(process.env, crawler) : null;

if (!["start", "finish"].includes(action) || !crawler) {
  console.error("usage: crawl-run.ts start|finish <crawler path> [outcome]");
  process.exit(2);
}

if (!url || !id) {
  console.log(`crawl status not recorded (${!url ? "CRAWL_DATABASE_URL is not set" : "not a GitHub Actions run"})`);
} else {
  try {
    const db = getDb(url);
    if (action === "start") {
      await startRun(db, { id, crawler, runUrl: runUrl(process.env) });
      console.log(`${crawler}: marked as collecting (${id})`);
    } else {
      const status = outcomeStatus(outcome);
      const found = await finishRun(db, id, status);
      console.log(found ? `${crawler}: ${status}` : `${crawler}: no running row ${id}; nothing to finish`);
    }
  } catch (err) {
    console.warn(`::warning::crawl status not recorded: ${err instanceof Error ? err.message : err}`);
  } finally {
    await closeDb().catch(() => {});
  }
}
