const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// GET /api/deals/top?type=&brand=&limit=
router.get("/top", async (req, res, next) => {
  try {
    const { type, brand } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    const conditions = [];
    const params = [];

    if (typeof type === "string") {
      params.push(type);
      conditions.push(`club_type = $${params.length}`);
    }
    if (typeof brand === "string") {
      params.push(brand);
      conditions.push(`brand_name = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT * FROM current_best_deals ${where} LIMIT $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
