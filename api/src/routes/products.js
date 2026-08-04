const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const { rows: productRows } = await pool.query(
      `SELECT p.*, b.name AS brand_name
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       WHERE p.id = $1`,
      [productId]
    );
    const product = productRows[0];
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { rows: listings } = await pool.query(
      `SELECT l.id AS listing_id, l.condition, l.price_cents, l.original_price_cents,
              l.currency, l.product_url, l.in_stock, l.last_seen_at,
              s.id AS seller_id, s.name AS seller_name
       FROM listings l
       JOIN sellers s ON s.id = l.seller_id
       WHERE l.product_id = $1
       ORDER BY l.price_cents ASC`,
      [productId]
    );

    res.json({ ...product, listings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
