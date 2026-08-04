const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// GET /api/sellers
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, seller_type, website_url
       FROM sellers
       WHERE is_active = true
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
