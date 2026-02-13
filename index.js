const express = require("express");
const app = express();

app.use(express.json());

// Cloud Run uses PORT env. Keep fallback for local runs.
const PORT = process.env.PORT || 8080;

// DATA_MODE: "demo" | "live"
// For ALPHA stability, you can default to "demo" when not set.
// If you want to FORCE demo regardless of env, uncomment the FORCE line below.
const DATA_MODE = process.env.DATA_MODE || "demo";
// const DATA_MODE = "demo"; // FORCE DEMO MODE (optional)

/**
 * Root route - avoids "Cannot GET /"
 * If you later host a frontend separately, keep this for quick status checks.
 */
app.get("/", (req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send(`SHFantasy Backend is live 🚀\nDATA_MODE=${DATA_MODE}\n`);
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
 * This prevents frontend from crashing if it accidentally calls this service.
 * Your real app should have its own pools service / routes.
 */
app.get("/api/pools", (req, res) => {
  res.status(200).json({
    data_mode: DATA_MODE,
    pools: [],
    note: "Backend stub active. Replace with real pools endpoint when ready.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (DATA_MODE=${DATA_MODE})`);
});
