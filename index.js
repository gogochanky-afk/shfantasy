const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Boot logs (Cloud Run logs)
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

// ---- Health + Ping
app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ping", (req, res) => res.status(200).json({ ok: true, message: "pong" }));

/**
 * ============================
 * DEMO API (keep your existing)
 * ============================
 * If you already have /api/games /api/pools logic, keep it.
 * Below is minimal fallback so frontend can show something.
 */

// --- Demo data helpers
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

function demoPoolsFor(dateStr) {
  const games = demoGamesFor(dateStr);
  return games.map((g) => ({
    id: `${dateStr}-${g.gameId}`,
    name: `Daily Blitz: ${g.away.code} @ ${g.home.code}`,
    gameId: g.gameId,
    date: dateStr,
    lockAt: g.startAt,
    salaryCap: 10,
    rosterSize: 5,
    entryFee: 5,
    prize: 100,
    mode: "DEMO",
  }));
}

// ---- API routes (use your real ones if exist)
app.get("/api/games", (req, res) => {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 24 * 3600 * 1000));
  res.json({
    ok: true,
    mode: "DEMO",
    games: [...demoGamesFor(today), ...demoGamesFor(tomorrow)],
  });
});

app.get("/api/pools", (req, res) => {
  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 24 * 3600 * 1000));
  res.json({
    ok: true,
    mode: "DEMO",
    pools: [...demoPoolsFor(today), ...demoPoolsFor(tomorrow)],
  });
});

// ============================
// Serve Frontend (Vite dist)
// ============================
const distPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(distPath));

// SPA fallback (must be last)
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`BOOT: server listening on ${port}`);
});
