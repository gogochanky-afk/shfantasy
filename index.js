const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Boot logs (for Cloud Run logs)
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

// ---- Health + Ping
app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ping", (req, res) => res.status(200).json({ ok: true, message: "pong" }));

// ---- Demo data helpers
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function demoGamesFor(dateStr) {
  const base = dateStr.replaceAll("-", "");
  return [
    {
      gameId: `demo-${base}-001`,
      date: dateStr,
      home: { teamId: 1, code: "LAL", name: "Lakers" },
      away: { teamId: 2, code: "GSW", name: "Warriors" },
      startAt: `${dateStr}T11:00:00.000Z`,
      status: "scheduled",
      dataMode: "DEMO",
    },
    {
      gameId: `demo-${base}-002`,
      date: dateStr,
      home: { teamId: 3, code: "BOS", name: "Celtics" },
      away: { teamId: 4, code: "MIA", name: "Heat" },
      startAt: `${dateStr}T13:30:00.000Z`,
      status: "scheduled",
      dataMode: "DEMO",
    },
  ];
}

function demoPools() {
  const now = new Date();
  return [
    {
      id: "demo-1",
      name: "Demo Pool",
      prize: 100,
      entry: 5,
      lockAt: now.toISOString(),
      mode: "DEMO",
    },
  ];
}

// ---- API routes (ensure these exist)
app.get("/api/games", (req, res) => {
  const date = (req.query.date && String(req.query.date)) || isoDate(new Date());
  return res.status(200).json({ ok: true, mode: "DEMO", games: demoGamesFor(date) });
});

app.get("/api/pools", (req, res) => {
  return res.status(200).json({ ok: true, mode: "DEMO", pools: demoPools() });
});

// ---- Serve frontend if built
const distDir = path.join(__dirname, "frontend", "dist");
const indexHtml = path.join(distDir, "index.html");

if (fs.existsSync(indexHtml)) {
  console.log("BOOT: Serving frontend from", distDir);

  app.use(express.static(distDir));

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  console.log("BOOT: frontend not built (missing frontend/dist/index.html)");

  app.get("/", (req, res) => {
    res
      .status(200)
      .send("Backend is running (frontend not built). Try /api/games or /api/pools");
  });
}

app.listen(port, () => console.log(`Server listening on ${port}`));
