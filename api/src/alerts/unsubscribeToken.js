const crypto = require("crypto");

// HMAC-signs a watchlist_item id so an unsubscribe link can be validated
// without requiring login, and can't be forged to remove someone else's watch.
function signWatchlistItemId(id) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(String(id)).digest("hex");
}

function verifyWatchlistItemId(id, token) {
  let expected;
  try {
    expected = signWatchlistItemId(id);
  } catch {
    return false;
  }

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(token ?? ""), "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signWatchlistItemId, verifyWatchlistItemId };
