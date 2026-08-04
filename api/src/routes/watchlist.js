const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// POST /api/watchlist  { email, listing_id, target_price_cents? }
router.post("/", async (req, res, next) => {
  try {
    const { email, listing_id, target_price_cents } = req.body ?? {};

    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!Number.isInteger(listing_id)) {
      return res.status(400).json({ error: "listing_id is required" });
    }
    if (
      target_price_cents !== undefined &&
      target_price_cents !== null &&
      !Number.isInteger(target_price_cents)
    ) {
      return res.status(400).json({ error: "target_price_cents must be an integer" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: userRows } = await client.query(
        `INSERT INTO users (email) VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email`,
        [email]
      );
      const user = userRows[0];

      const { rows: watchRows } = await client.query(
        `INSERT INTO watchlist_items (user_id, listing_id, target_price_cents)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, listing_id)
         DO UPDATE SET target_price_cents = EXCLUDED.target_price_cents
         RETURNING id, user_id, listing_id, target_price_cents, created_at`,
        [user.id, listing_id, target_price_cents ?? null]
      );

      await client.query("COMMIT");
      res.status(201).json({ ...watchRows[0], email: user.email });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/watchlist/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid watchlist id" });
    }

    const { rowCount } = await pool.query(`DELETE FROM watchlist_items WHERE id = $1`, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Watchlist item not found" });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
