const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

// existing scripts
const { syncSchedule } = require("./scripts/sync-schedule");
const { seedPlayers } = require("./scripts/seed-players");

const app = express();
const port = process.env.PORT || 8080;

// ---------- Basic middleware ----------
app.use(express.json());

// ---------- Boot logs (Cloud Run logs) ----------
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV =", process.env.NODE_ENV);
console.log("BOOT: PORT =", port);

// ---------- DB ----------
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.sqlite");
const db = new Database(DB_PATH);

// ---------- Helpers ----------
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

// ---------- Schema ----------
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

    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      gameId TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT,
      lockAt TEXT,
      salaryCap INTEGER DEFAULT 10,
      rosterSize INTEGER DEFAULT 5,
      entryFee INTEGER DEFAULT 5,
      prize INTEGER DEFAULT 100,
      mode TEXT DEFAULT 'DEMO',
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pools_date ON pools(date);
    CREATE INDEX IF NOT EXISTS idx_pools_gameId ON pools(gameId);

    -- ✅ NEW: teams
    CREATE TABLE IF NOT EXISTS teams (
      teamId INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    -- ✅ NEW: players
    CREATE TABLE IF NOT EXISTS players (
      playerId TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      pos TEXT,
      teamId INTEGER,
      price INTEGER DEFAULT 2,
      isActive INTEGER DEFAULT 1,
      updatedAt TEXT
    );

    -- ✅ NEW: roster snapshots
    CREATE TABLE IF NOT EXISTS roster_players (
      date TEXT NOT NULL,
      teamId INTEGER NOT NULL,
      playerId TEXT NOT NULL,
      PRIMARY KEY (date, teamId, playerId)
    );
    CREATE INDEX IF NOT EXISTS idx_roster_players_date_team ON roster_players(date, teamId);
  `);
}
ensureSchema();

// ---------- Pool generation (deterministic) ----------
function ensurePoolsForTodayTomorrow() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const games = db
    .prepare(
      `SELECT * FROM games WHERE date IN (?, ?) ORDER BY date ASC, startAt ASC`
    )
    .all(today, tomorrow);

  const upsert = db.prepare(`
    INSERT INTO pools (id, gameId, date, name, lockAt, salaryCap, rosterSize, entryFee, prize, mode, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      lockAt=excluded.lockAt,
      updatedAt=excluded.updatedAt
  `);

  const nowIso = new Date().toISOString();
  let count = 0;

  for (const g of games) {
    const id = `${g.date}-${g.gameId}`; // deterministic
    const name = `Daily Blitz: ${g.awayCode || "AWAY"} @ ${g.homeCode || "HOME"}`;
    const lockAt = g.startAt || new Date().toISOString();

    const mode = g.source === "ESPN" ? "LIVE" : "DEMO";

    upsert.run(
      id,
      g.gameId,
      g.date,
      name,
      lockAt,
      10,
      5,
      5,
      100,
      mode,
      nowIso
    );
    count++;
  }

  return { ok: true, poolsUpserted: count, dates: [today, tomorrow] };
}

// ---------- API ----------
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

// list games (today+tomorrow)
app.get("/api/games", (req, res) => {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const games = db
    .prepare(
      `SELECT * FROM games WHERE date IN (?, ?) ORDER BY date ASC, startAt ASC`
    )
    .all(today, tomorrow);

  const mode = games.some((g) => g.source === "ESPN") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, games });
});

// list pools (today+tomorrow)
app.get("/api/pools", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const pools = db
    .prepare(
      `SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`
    )
    .all(today, tomorrow);

  const mode = pools.some((p) => p.mode === "LIVE") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, poolResult, pools });
});

// backward compatible: /api/pool returns same as /api/pools
app.get("/api/pool", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const pools = db
    .prepare(
      `SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`
    )
    .all(today, tomorrow);

  const mode = pools.some((p) => p.mode === "LIVE") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, poolResult, pools });
});

// pool by id
app.get("/api/pool/:id", (req, res) => {
  ensurePoolsForTodayTomorrow();
  const pool = db.prepare(`SELECT * FROM pools WHERE id = ?`).get(req.params.id);
  if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });
  res.json({ ok: true, pool });
});

// ✅ NEW: list teams
app.get("/api/teams", (req, res) => {
  const teams = db
    .prepare(`SELECT teamId, code, name FROM teams ORDER BY teamId ASC`)
    .all();
  res.json({ ok: true, teams });
});

// ✅ NEW: list players by date + teamId
// GET /api/players?teamId=1&date=YYYY-MM-DD
app.get("/api/players", (req, res) => {
  const date = req.query.date || isoDate(new Date());
  const teamId = Number(req.query.teamId);

  if (!teamId || Number.isNaN(teamId)) {
    return res.status(400).json({ ok: false, error: "teamId is required" });
  }

  const players = db
    .prepare(
      `
      SELECT p.playerId, p.fullName, p.pos, p.teamId, p.price
      FROM roster_players rp
      JOIN players p ON p.playerId = rp.playerId
      WHERE rp.date = ? AND rp.teamId = ? AND p.isActive = 1
      ORDER BY p.price DESC, p.fullName ASC
    `
    )
    .all(date, teamId);

  res.json({ ok: true, mode: "DEMO", date, teamId, players });
});

// admin: sync schedule (real) -> then generate pools
app.get("/api/admin/sync-schedule", async (req, res) => {
  try {
    const result = await syncSchedule({ dryRun: false });
    const poolResult = ensurePoolsForTodayTomorrow();
    res.json({ ok: true, result, poolResult });
  } catch (e) {
    console.error("sync-schedule error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ✅ NEW: admin seed players (today + tomorrow roster snapshot)
// GET /api/admin/seed-players
app.get("/api/admin/seed-players", (req, res) => {
  try {
    const today = isoDate(new Date());
    const tomorrow = isoDate(addDays(new Date(), 1));
    const result = seedPlayers({ dbPath: DB_PATH, dates: [today, tomorrow] });
    res.json({ ok: true, result });
  } catch (e) {
    console.error("seed-players error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Frontend static (if you have /frontend/dist) ----------
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ---------- Start ----------
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
