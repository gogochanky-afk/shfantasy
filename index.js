const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.json());

/**
 * ROOT (避免 Google 404 畫面)
 */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "SHFantasy backend running" });
});

/**
 * Health check (Cloud Run)
 */
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

/**
 * Ping test
 */
app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

/**
 * Pools endpoint (Demo data)
 */
app.get("/api/pools", (req, res) => {
  res.json({
    ok: true,
    pools: [
      {
        id: "demo-1",
        name: "Demo Pool",
        prize: 100,
        entry: 5
      }
    ]
  });
});

/**
 * 404 fallback
 */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Not found"
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
