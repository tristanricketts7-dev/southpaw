require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const fs = require("fs");
const path = require("path");
const { pool } = require("../db");
const { normalizeRecord } = require("./normalize");
const { loadLocalJsonFeed } = require("./adapters/localJsonAdapter");
const { loadCsvFeed } = require("./adapters/csvAdapter");
const { upsertSeller, upsertSellerByName, upsertRecord } = require("./upsert");

const ADAPTERS = {
  localJson: loadLocalJsonFeed,
  csv: loadCsvFeed,
};

const DEFAULT_CONFIG_PATH = path.join(__dirname, "..", "..", "config", "feed-sources.json");

async function runIngest(configPath = DEFAULT_CONFIG_PATH) {
  const sources = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const summary = [];

  for (const source of sources) {
    summary.push(await ingestSource(source));
  }

  return summary;
}

async function ingestSource(source) {
  const adapterType = source.adapter || source.type;
  const loadFeed = ADAPTERS[adapterType];
  const label = source.name || source.sellerName;
  if (!loadFeed) {
    throw new Error(`Unknown feed source adapter "${adapterType}" for source "${label}"`);
  }

  const rawRecords = loadFeed(source);

  const stats = {
    source: label,
    total: rawRecords.length,
    ingested: 0,
    priceChanges: 0,
    skipped: [],
  };

  const client = await pool.connect();
  try {
    // Some feeds map to one configured seller; others (e.g. a mixed CSV
    // aggregating several shops) carry a seller_name per row instead.
    const defaultSellerId = source.seller ? await upsertSeller(client, source.seller) : null;

    for (const raw of rawRecords) {
      const { ok, record, reason } = normalizeRecord(raw);
      if (!ok) {
        stats.skipped.push({ raw, reason });
        continue;
      }

      try {
        const sellerId = record.sellerName
          ? await upsertSellerByName(client, record.sellerName, record.productUrl)
          : defaultSellerId;

        if (!sellerId) {
          stats.skipped.push({ raw, reason: "no seller_name in row and no default seller configured for this source" });
          continue;
        }

        const { priceChanged } = await upsertRecord(client, sellerId, record);
        stats.ingested++;
        if (priceChanged) stats.priceChanges++;
      } catch (err) {
        stats.skipped.push({ raw, reason: err.message });
      }
    }
  } finally {
    client.release();
  }

  return stats;
}

if (require.main === module) {
  runIngest()
    .then((summary) => {
      for (const s of summary) {
        console.log(`[${s.source}] ingested ${s.ingested}/${s.total}, ${s.priceChanges} price change(s), ${s.skipped.length} skipped`);
        for (const skip of s.skipped) {
          console.log(`  skipped: ${skip.reason}`);
        }
      }
      return pool.end();
    })
    .catch((err) => {
      console.error("Ingest failed:", err);
      process.exitCode = 1;
      return pool.end();
    });
}

module.exports = { runIngest, ingestSource };
