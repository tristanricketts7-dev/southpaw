const { Router } = require("express");
const { pool } = require("../db");
const { verifyWatchlistItemId } = require("../alerts/unsubscribeToken");

const router = Router();

function page(bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Southpaw</title></head>
<body style="font-family:-apple-system,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:#1f4d3a;padding:0 20px;">
  <h2>Southpaw</h2>
  ${bodyHtml}
</body>
</html>`;
}

function invalidLinkResponse(res) {
  return res.status(400).send(page("<p>This unsubscribe link is invalid or has expired.</p>"));
}

// GET: shows a confirmation page rather than acting immediately -- avoids
// unsubscribing someone just because their email client prefetched the link.
router.get("/", (req, res) => {
  const id = Number(req.query.id);
  const token = req.query.token;

  if (!Number.isInteger(id) || !token || !verifyWatchlistItemId(id, token)) {
    return invalidLinkResponse(res);
  }

  res.send(page(`
    <p>Stop price-drop alerts for this item?</p>
    <a href="/api/unsubscribe/confirm?id=${id}&token=${encodeURIComponent(token)}"
       style="display:inline-block;padding:10px 20px;background:#1f4d3a;color:#ece2c8;border-radius:6px;text-decoration:none;">
      Yes, unsubscribe
    </a>
  `));
});

router.get("/confirm", async (req, res, next) => {
  try {
    const id = Number(req.query.id);
    const token = req.query.token;

    if (!Number.isInteger(id) || !token || !verifyWatchlistItemId(id, token)) {
      return invalidLinkResponse(res);
    }

    await pool.query(`DELETE FROM watchlist_items WHERE id = $1`, [id]);
    res.send(page("<p>You've been unsubscribed from price alerts for this item.</p>"));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
