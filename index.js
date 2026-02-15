const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Cloud Run uses PORT env
const PORT = process.env.PORT || 8080;

// DATA_MODE: "demo" | "live"
const DATA_MODE = process.env.DATA_MODE || "demo";

/**
 * API health check (used by frontend + monitoring)
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy",
    data_mode: DATA_MODE,
    ts: new Date().toISOString(),
  });
});

/**
 * API: Get available pools
 */
app.get("/api/pools", (req, res) => {
  // TODO: Replace with real data from database
  res.json({
    ok: true,
    pools: [
      {
        id: "demo-pool-1",
        name: "NBA Daily Blitz",
        entry_fee: 5,
        prize_pool: 100,
        entries: 12,
        max_entries: 50,
        start_time: new Date().toISOString(),
      },
    ],
    data_mode: DATA_MODE,
  });
});

/**
 * API: Get user entries
 */
app.get("/api/entries", (req, res) => {
  // TODO: Replace with real data from database
  res.json({
    ok: true,
    entries: [
      {
        id: "demo-entry-1",
        pool_id: "demo-pool-1",
        pool_name: "NBA Daily Blitz",
        status: "active",
        score: 0,
        rank: null,
        created_at: new Date().toISOString(),
      },
    ],
    data_mode: DATA_MODE,
  });
});

/**
 * Serve React frontend (static files from frontend/dist)
 */
const frontendPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendPath));

/**
 * SPA fallback: serve index.html for all non-API routes
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SHFantasy listening on ${PORT}`);
  console.log(`DATA_MODE=${DATA_MODE}`);
});
