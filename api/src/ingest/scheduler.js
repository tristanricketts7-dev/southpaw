require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const cron = require("node-cron");
const { runIngest } = require("./runIngest");
const { checkAlerts } = require("../alerts/checkAlerts");
const { pool } = require("../db");

// Twice daily: 06:00 and 18:00 server time.
const SCHEDULE = process.env.INGEST_CRON || "0 6,18 * * *";

async function runCycle() {
  console.log(`[scheduler] ingest cycle starting at ${new Date().toISOString()}`);
  try {
    const summary = await runIngest();
    for (const s of summary) {
      console.log(`[scheduler] [${s.source}] ingested ${s.ingested}/${s.total}, ${s.priceChanges} price change(s), ${s.skipped.length} skipped`);
    }
  } catch (err) {
    console.error("[scheduler] ingest failed:", err);
    return;
  }

  try {
    const alertSummary = await checkAlerts();
    console.log(`[scheduler] alerts: ${alertSummary.sent} sent, ${alertSummary.checked} watch(es) checked`);
  } catch (err) {
    console.error("[scheduler] alert check failed:", err);
  }
}

if (require.main === module) {
  console.log(`[scheduler] scheduling ingest + alerts on "${SCHEDULE}"`);
  cron.schedule(SCHEDULE, runCycle);

  if (process.env.RUN_ON_START === "true") {
    runCycle();
  }

  process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
  });
}

module.exports = { runCycle };
