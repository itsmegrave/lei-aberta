// Records a crawl in data/status/runs.json so the site can show it live. Called by the crawl workflows, which then
// commit data/status to the data branch (scripts/data-branch.sh push):
//   node scripts/crawl-run.ts start crawlers/federal/run.ts
//   node scripts/crawl-run.ts finish crawlers/federal/run.ts <steps.crawl.outcome>
// Status is a nicety: any problem here is logged and never fails the job.
import { outcomeStatus, runId, runUrl } from "../lib/crawl-runs.ts";
import { finishRun, startRun } from "../lib/crawl-runs-store.ts";

const [action, crawler, outcome = "success"] = process.argv.slice(2);
const id = crawler ? runId(process.env, crawler) : null;

if (!["start", "finish"].includes(action) || !crawler) {
  console.error("usage: crawl-run.ts start|finish <crawler path> [outcome]");
  process.exit(2);
}

if (!id) {
  console.log("crawl status not recorded (not a GitHub Actions run)");
} else {
  try {
    if (action === "start") {
      await startRun({ id, crawler, runUrl: runUrl(process.env) });
      console.log(`${crawler}: marked as collecting (${id})`);
    } else {
      const status = outcomeStatus(outcome);
      const found = await finishRun(id, status);
      console.log(found ? `${crawler}: ${status}` : `${crawler}: no running entry ${id}; nothing to finish`);
    }
  } catch (err) {
    console.warn(`::warning::crawl status not recorded: ${err instanceof Error ? err.message : err}`);
  }
}
