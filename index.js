const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { syncSchedule } = require("./scripts/sync-schedule");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Boot logs (for Cloud Run logs)
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

// ---- DB
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "shfantasy.db");
const db = new Database(DB_PATH);

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      gameId TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      startAt TEXT,
      status TEXT,
      homeCode TEXT,
      homeName TEXT,
      awayCode TEXT,
      awayName TEXT,
      source TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
  `);
}

ensureSchema();

// ---- Helpers
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

function getDbGames(dateStr) {
  const rows = db
    .prepare(
      `SELECT gameId, date, startAt, status, homeCode, homeName, awayCode, awayName FROM games WHERE date=? ORDER BY startAt ASC`
    )
    .all(dateStr);

  return rows.map((r, idx) => ({
    gameId: r.gameId,
    date: r.date,
    home: { teamId: idx * 2 + 1, code: r.homeCode || "TBD", name: r.homeName || "TBD" },
    away: { teamId: idx * 2 + 2, code: r.awayCode || "TBD", name: r.awayName || "TBD" },
    startAt: r.startAt,
    status: r.status || "scheduled",
    dataMode: "LIVE",
  }));
}

function getTodayTomorrow() {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  return [isoDate(today), isoDate(tomorrow)];
}

function buildPoolsFromGames(games) {
  // Deterministic poolId: {date}-{gameId}
  return games.map((g) => {
    const id = `${g.date}-${g.gameId}`;
    const name = `Daily Blitz: ${g.away.code} @ ${g.home.code}`;
    return {
      id,
      name,
      gameId: g.gameId,
      date: g.date,
      lockAt: g.startAt,
      salaryCap: 10,
      rosterSize: 5,
      entryFee: 5,
      prize: 100,
      mode: g.dataMode, // DEMO or LIVE
    };
  });
}

// ---- Health + Ping
app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ping", (req, res) => res.status(200).json({ ok: true, message: "pong" }));

// ---- Admin: trigger schedule sync (use Cloud Scheduler later)
// Call: /api/admin/sync-schedule?token=YOUR_TOKEN
app.get("/api/admin/sync-schedule", async (req, res) => {
  const token = req.query.token;
  const expected = process.env.SYNC_TOKEN;

  if (!expected) {
    return res.status(500).json({ ok: false, error: "SYNC_TOKEN not set" });
  }
  if (token !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const result = await syncSchedule({ dbPath: DB_PATH });
    return res.status(200).json(result);
  } catch (e) {
    console.error("SYNC_SCHEDULE_ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- API: games (DB first; fallback DEMO)
app.get("/api/games", (req, res) => {
  const [d1, d2] = getTodayTomorrow();

  const live1 = getDbGames(d1);
  const live2 = getDbGames(d2);

  const hasLive = live1.length + live2.length > 0;
  const games = hasLive
    ? [...live1, ...live2]
    : [...demoGamesFor(d1), ...demoGamesFor(d2)];

  return res.status(200).json({
    ok: true,
    mode: hasLive ? "LIVE" : "DEMO",
    games,
  });
});

// ---- API: pools (built from /api/games logic)
app.get("/api/pools", (req, res) => {
  const [d1, d2] = getTodayTomorrow();

  const live1 = getDbGames(d1);
  const live2 = getDbGames(d2);

  const hasLive = live1.length + live2.length > 0;
  const games = hasLive
    ? [...live1, ...live2]
    : [...demoGamesFor(d1), ...demoGamesFor(d2)];

  const pools = buildPoolsFromGames(games);

  return res.status(200).json({
    ok: true,
    mode: hasLive ? "LIVE" : "DEMO",
    pools,
  });
});

// ---- Serve frontend (if built)
const distPath = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  app.get("/", (req, res) => {
    res.status(200).send("Backend is running (frontend not built). Try /api/games or /api/pools");
  });
}

app.listen(port, () => {
  console.log(`BOOT: Server listening on ${port}`);
});
