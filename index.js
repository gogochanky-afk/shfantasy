const express = require("express");

const app = express();

app.use(express.json());

// Cloud Run uses PORT env. Keep fallback 8080 for local.
const PORT = process.env.PORT || 8080;

// Optional: set DATA_MODE in Cloud Run env: LIVE or DEMO
const DATA_MODE = process.env.DATA_MODE || "DEMO";

/**
 * Root route - avoids "Cannot GET /"
 * If you later host a frontend separately, you can keep this as a simple status page.
 */
app.get("/", (req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send(`SHFantasy Backend is live 🚀\nDATA_MODE: ${DATA_MODE}\n`);
});

/**
 * Health check - quick verification for Cloud Run
 */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "SHFantasy",
    data_mode: DATA_MODE,
  });
});

/**
 * Test endpoint
 */
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "API working 🚀",
    data_mode: DATA_MODE,
  });
});

/**
 * Pools endpoint (STUB)
 * This prevents frontend from crashing with "Cannot GET /api/pools".
 * Manus can later replace this with real logic (DB + today/tomorrow filtering).
 */
app.get("/api/pools", (req, res) => {
  res.status(200).json({
    data_mode: DATA_MODE,
    pools: [],
    note: "STUB endpoint. Replace with real pools service.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (DATA_MODE=${DATA_MODE})`);
});
