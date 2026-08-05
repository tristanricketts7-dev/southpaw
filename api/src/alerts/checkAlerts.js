require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { pool } = require("../db");
const { getEmailProvider } = require("./emailProvider");
const { buildPriceDropEmail } = require("./emailTemplate");
const { signWatchlistItemId } = require("./unsubscribeToken");

// Finds watchlist items whose listing price just dropped (latest price_history
// entry is lower than the one before it), still meets the user's target (or no
// target was set), and hasn't already triggered an alert at this exact price.
const FIND_DUE_ALERTS_SQL = `
  SELECT
    w.id AS watchlist_item_id, w.target_price_cents,
    u.email,
    l.id AS listing_id, l.price_cents, l.currency, l.product_url,
    p.name AS product_name, b.name AS brand_name, s.name AS seller_name,
    ph.prev_price_cents
  FROM watchlist_items w
  JOIN users u ON u.id = w.user_id
  JOIN listings l ON l.id = w.listing_id
  JOIN products p ON p.id = l.product_id
  JOIN brands b ON b.id = p.brand_id
  JOIN sellers s ON s.id = l.seller_id
  JOIN LATERAL (
    SELECT price_cents AS prev_price_cents
    FROM price_history
    WHERE listing_id = l.id
      AND recorded_at < (SELECT MAX(recorded_at) FROM price_history WHERE listing_id = l.id)
    ORDER BY recorded_at DESC
    LIMIT 1
  ) ph ON true
  WHERE l.in_stock = true
    AND l.price_cents < ph.prev_price_cents
    AND (w.target_price_cents IS NULL OR l.price_cents <= w.target_price_cents)
    AND NOT EXISTS (
      SELECT 1 FROM alerts_sent a
      WHERE a.watchlist_item_id = w.id AND a.price_cents_at_send = l.price_cents
    )
`;

async function checkAlerts() {
  const provider = getEmailProvider();
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  const { rows } = await pool.query(FIND_DUE_ALERTS_SQL);

  let sent = 0;
  for (const row of rows) {
    const token = signWatchlistItemId(row.watchlist_item_id);
    const unsubscribeUrl = `${apiBaseUrl}/api/unsubscribe?id=${row.watchlist_item_id}&token=${token}`;

    const { subject, body } = buildPriceDropEmail({
      productName: row.product_name,
      brandName: row.brand_name,
      sellerName: row.seller_name,
      priceCents: row.price_cents,
      previousPriceCents: row.prev_price_cents,
      currency: row.currency,
      productUrl: row.product_url,
      appBaseUrl,
      unsubscribeUrl,
    });

    try {
      await provider.sendEmail({ to: row.email, subject, body });
      await pool.query(
        `INSERT INTO alerts_sent (watchlist_item_id, price_cents_at_send) VALUES ($1, $2)`,
        [row.watchlist_item_id, row.price_cents]
      );
      sent++;
    } catch (err) {
      console.error(`[alerts] failed to send to ${row.email} for watchlist_item ${row.watchlist_item_id}:`, err.message);
    }
  }

  return { checked: rows.length, sent };
}

if (require.main === module) {
  checkAlerts()
    .then((summary) => {
      console.log(`[alerts] checked ${summary.checked} due alert(s), sent ${summary.sent}`);
      return pool.end();
    })
    .catch((err) => {
      console.error("[alerts] check failed:", err);
      process.exitCode = 1;
      return pool.end();
    });
}

module.exports = { checkAlerts };
