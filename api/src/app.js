const express = require("express");
const cors = require("cors");
const path = require("path");
const { pool } = require("./db");

const listingsRouter = require("./routes/listings");
const dealsRouter = require("./routes/deals");
const productsRouter = require("./routes/products");
const sellersRouter = require("./routes/sellers");
const brandsRouter = require("./routes/brands");
const watchlistRouter = require("./routes/watchlist");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json());

// Serves the single-file static frontend for local/dev convenience (same-origin, no CORS setup needed).
app.use(express.static(path.join(__dirname, "..", "..", "public")));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

app.use("/api/listings", listingsRouter);
app.use("/api/deals", dealsRouter);
app.use("/api/products", productsRouter);
app.use("/api/sellers", sellersRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/watchlist", watchlistRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = { app };
