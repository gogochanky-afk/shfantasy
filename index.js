console.log("BOOT: index.js loaded", new Date().toISOString());
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV, "PORT=", process.env.PORT);
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Health + Ping (MUST be before static/SPAs) ----
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, service: "shfantasy", status: "healthy" });
});

app.get("/ping", (req, res) => {
  res.status(200).json({ ok: true, message: "pong" });
});

// ---- Pools API (support BOTH /api/pools and /pools to avoid confusion) ----
function demoPools() {
  return [
    {
      id: "demo-1",
      name: "Demo Pool",
      prize: 100,
      entry: 5,
      lockAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      mode: "DEMO",
    },
  ];
}

app.get(["/api/pools", "/pools"], (req, res) => {
  res.status(200).json({
    ok: true,
    mode: "DEMO",
    pools: demoPools(),
  });
});

// ---- Serve frontend if exists ----
// This keeps your SHFantasy Alpha UI working at "/"
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));

// SPA fallback (only for non-API routes)
app.get("*", (req, res) => {
  // If someone hits unknown API path, return JSON 404 (not HTML)
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, message: "Not found" });
  }

  // Try to serve SPA index.html if built
  return res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      // If frontend not built, at least don't show Google 404
      res.status(200).json({
        ok: true,
        message: "Backend is running (frontend not built).",
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
