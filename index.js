const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

/* ================================
   Health + Ping
================================ */
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/ping", (req, res) => {
  res.status(200).json({ ok: true, message: "pong" });
});

/* ================================
   Demo Helpers
================================ */
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

function demoPoolsFor(games) {
  return games.map((g) => ({
    id: `${g.date}-${g.gameId}`,
    name: `Daily Blitz: ${g.away.code} @ ${g.home.code}`,
    gameId: g.gameId,
    date: g.date,
    lockAt: g.startAt,
    salaryCap: 10,
    rosterSize: 5,
    entryFee: 5,
    prize: 100,
    mode: "DEMO",
  }));
}

/* ================================
   API
================================ */
app.get("/api/games", (req, res) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const dates = [isoDate(today), isoDate(tomorrow)];
  const games = dates.flatMap((d) => demoGamesFor(d));

  res.json({
    ok: true,
    mode: "DEMO",
    games,
  });
});

app.get("/api/pools", (req, res) => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const dates = [isoDate(today), isoDate(tomorrow)];
  const games = dates.flatMap((d) => demoGamesFor(d));
  const pools = demoPoolsFor(games);

  res.json({
    ok: true,
    mode: "DEMO",
    pools,
  });
});

/* ================================
   Serve Frontend (IMPORTANT)
================================ */
const frontendDist = path.join(__dirname, "frontend", "dist");

if (fs.existsSync(frontendDist)) {
  console.log("Serving frontend from:", frontendDist);

  app.use(express.static(frontendDist));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  console.log("Frontend build not found, API-only mode");
}

/* ================================
   Start Server
================================ */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
