const { Router } = require("express");
const { pool } = require("../db");

const router = Router();

// GET /api/brands
router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT id, name FROM brands ORDER BY name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
