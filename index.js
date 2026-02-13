const express = require("express");
const app = express();

app.use(express.json());

// Cloud Run uses PORT env
const PORT = process.env.PORT || 8080;

// FORCE DEMO MODE FOR ALPHA STABILITY
const DATA_MODE = process.env.DATA_MODE || "DEMO";

/**
 * Root route
 */
app.get("/", (req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send(`SHFantasy Backend is live 🚀\nDATA_MODE=${DATA_MODE}`);
});

/**
 * Health Check
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
 * Pools STUB (safe for frontend)
 */
app.get("/api/pools", (req, res) => {
  res.status(200).json({
    data_mode: DATA_MODE,
    pools: [],
    note: "Backend stub active. Replace with real pools service.",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
