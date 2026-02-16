const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Boot logs (for Cloud Run logs) ----
console.log("BOOT: index.js loaded", new Date().toISOString());
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

// ---- Health + Ping (keep before static) ----
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true, service: "shfantasy", ts: new Date().toISOString() });
});

app.get("/ping", (req, res) => {
  res.status(200).json({ ok: true, message: "pong" });
});

// ---- DEMO fallback games generator (today + tomorrow) ----
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function demoGamesFor(dateStr) {
  // deterministic fake games for the date (so refresh won't "random")
  // You can replace this later with Sportradar schedule + DB
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

function getTodayTomorrowGames() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const d1 = isoDate(today);
  const d2 = isoDate(tomorrow);

  // Later: try LIVE data from DB/Sportradar, if fail -> fallback
  const mode = "DEMO";
  const games = [...demoGamesFor(d1), ...demoGamesFor(d2)];
  return { mode, games };
}

// ---- Pools generator (deterministic from gameId + date) ----
function poolsFromGames(games, mode) {
  // Daily Blitz pool per game (you can change to per-slate later)
  return games.map((g) => {
    const poolId = `${g.date}-${g.gameId}`; // deterministic
    const lockAt = g.startAt; // lock at start time
    return {
      id: poolId,
      name: `Daily Blitz: ${g.away.code} @ ${g.home.code}`,
      gameId: g.gameId,
      date: g.date,
      lockAt,
      salaryCap: 10,
      rosterSize: 5,
      entryFee: 5,
      prize: 100,
      mode, // DEMO / LIVE
    };
  });
}

// ---- APIs ----
app.get(["/api/games", "/games"], (req, res) => {
  const { mode, games } = getTodayTomorrowGames();
  res.status(200).json({ ok: true, mode, games });
});

app.get(["/api/pools", "/pools"], (req, res) => {
  const { mode, games } = getTodayTomorrowGames();
  const pools = poolsFromGames(games, mode);
  res.status(200).json({ ok: true, mode, pools });
});

// ---- Serve frontend if exists ----
const frontendDist = path.join(__dirname, "dist");
app.use(express.static(frontendDist));

// SPA fallback (only for non-API routes)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, message: "Not found" });
  }

  // If dist/index.html exists, serve it; else show backend ok
  return res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      res.status(200).send("Backend is running (frontend not built). Try /api/games or /api/pools");
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
