const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

const SORT_COLUMNS = {
  deal: "discount_pct DESC NULLS LAST",
  price: "l.price_cents ASC",
  name: "p.name ASC",
};

// GET /api/listings?type=&brand=&seller=&condition=&search=&sort=&page=&pageSize=
router.get("/", async (req, res, next) => {
  try {
    const { type, brand, seller, condition, search } = req.query;
    const sort = SORT_COLUMNS[req.query.sort] || SORT_COLUMNS.deal;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const conditions = ["l.in_stock = true"];
    const params = [];

    if (typeof type === "string") {
      params.push(type);
      conditions.push(`p.club_type = $${params.length}`);
    }
    if (typeof brand === "string") {
      params.push(brand);
      conditions.push(`b.name = $${params.length}`);
    }
    if (typeof seller === "string") {
      params.push(seller);
      conditions.push(`s.name = $${params.length}`);
    }
    if (typeof condition === "string") {
      params.push(condition);
      conditions.push(`l.condition = $${params.length}`);
    }
    if (typeof search === "string" && search.trim() !== "") {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR b.name ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const baseQuery = `
      FROM listings l
      JOIN products p ON p.id = l.product_id
      JOIN brands b ON b.id = p.brand_id
      JOIN sellers s ON s.id = l.seller_id
      ${where}
    `;

    const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS total ${baseQuery}`, params);
    const total = countRows[0].total;

    const dataParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT
         l.id AS listing_id, l.condition, l.price_cents, l.original_price_cents,
         l.currency, l.product_url, l.in_stock, l.last_seen_at,
         p.id AS product_id, p.name AS product_name, p.club_type, p.loft, p.shaft, p.length, p.lie_angle, p.image_url,
         b.name AS brand_name,
         s.id AS seller_id, s.name AS seller_name,
         CASE WHEN l.original_price_cents IS NOT NULL AND l.original_price_cents > l.price_cents
           THEN ROUND(100.0 * (l.original_price_cents - l.price_cents) / l.original_price_cents)
           ELSE 0 END AS discount_pct
       ${baseQuery}
       ORDER BY ${sort}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    res.json({ data: rows, page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/listings/:id/price-history
router.get("/:id/price-history", async (req, res, next) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: "Invalid listing id" });
    }

    const { rows } = await pool.query(
      `SELECT price_cents, recorded_at
       FROM price_history
       WHERE listing_id = $1
       ORDER BY recorded_at ASC`,
      [listingId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
