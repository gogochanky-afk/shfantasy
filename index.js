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
