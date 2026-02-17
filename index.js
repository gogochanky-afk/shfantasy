const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const { syncSchedule } = require("./scripts/sync-schedule");
const { seedPlayers } = require("./scripts/seed-players");

const app = express();
const port = process.env.PORT || 8080;

// ---------- Basic middleware ----------
app.use(express.json());

// ---------- Boot logs ----------
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
function nowIso() {
  return new Date().toISOString();
}

// ---------- Schema ----------
function ensureSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;

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

    -- Teams & Players (seeded first; later can be replaced by real source)
    CREATE TABLE IF NOT EXISTS teams (
      teamId INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      playerId TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      pos TEXT,
      teamId INTEGER,
      price INTEGER DEFAULT 2,
      isActive INTEGER DEFAULT 1,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_players_teamId ON players(teamId);
    CREATE INDEX IF NOT EXISTS idx_players_active ON players(isActive);

    -- roster snapshot per date (single source of truth for Alpha)
    CREATE TABLE IF NOT EXISTS roster_players (
      date TEXT NOT NULL,
      teamId INTEGER NOT NULL,
      playerId TEXT NOT NULL,
      PRIMARY KEY (date, teamId, playerId)
    );
    CREATE INDEX IF NOT EXISTS idx_roster_date_team ON roster_players(date, teamId);

    -- entries
    CREATE TABLE IF NOT EXISTS entries (
      entryId TEXT PRIMARY KEY,
      poolId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      totalCost INTEGER NOT NULL,
      rosterSize INTEGER NOT NULL,
      status TEXT DEFAULT 'submitted'
    );
    CREATE INDEX IF NOT EXISTS idx_entries_poolId ON entries(poolId);

    CREATE TABLE IF NOT EXISTS entry_players (
      entryId TEXT NOT NULL,
      playerId TEXT NOT NULL,
      teamId INTEGER,
      price INTEGER,
      PRIMARY KEY (entryId, playerId)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_players_entryId ON entry_players(entryId);
  `);
}
ensureSchema();

// ---------- Pool generation (deterministic) ----------
function ensurePoolsForTodayTomorrow() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const games = db
    .prepare(`SELECT * FROM games WHERE date IN (?, ?) ORDER BY date ASC, startAt ASC`)
    .all(today, tomorrow);

  const upsert = db.prepare(`
    INSERT INTO pools (id, gameId, date, name, lockAt, salaryCap, rosterSize, entryFee, prize, mode, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      lockAt=excluded.lockAt,
      updatedAt=excluded.updatedAt
  `);

  const now = nowIso();
  let count = 0;

  for (const g of games) {
    const id = `${g.date}-${g.gameId}`;
    const name = `Daily Blitz: ${g.awayCode || "AWAY"} @ ${g.homeCode || "HOME"}`;
    const lockAt = g.startAt || nowIso();
    const mode = g.source === "ESPN" ? "LIVE" : "DEMO";

    upsert.run(id, g.gameId, g.date, name, lockAt, 10, 5, 5, 100, mode, now);
    count++;
  }

  return { ok: true, poolsUpserted: count, dates: [today, tomorrow] };
}

// ---------- Read pool + inferred teams ----------
function getPoolOr404(poolId) {
  ensurePoolsForTodayTomorrow();
  const pool = db.prepare(`SELECT * FROM pools WHERE id = ?`).get(poolId);
  return pool || null;
}

function getGameById(gameId) {
  return db.prepare(`SELECT * FROM games WHERE gameId = ?`).get(gameId) || null;
}

function inferTeamsFromGame(game) {
  // assumes your seed teams uses LAL/GSW/BOS/MIA codes etc.
  const home = db.prepare(`SELECT * FROM teams WHERE code = ?`).get(game.homeCode) || null;
  const away = db.prepare(`SELECT * FROM teams WHERE code = ?`).get(game.awayCode) || null;
  return { home, away };
}

// ---------- API ----------
app.get("/api/ping", (req, res) => res.json({ ok: true, message: "pong" }));

app.get("/api/games", (req, res) => {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const games = db
    .prepare(`SELECT * FROM games WHERE date IN (?, ?) ORDER BY date ASC, startAt ASC`)
    .all(today, tomorrow);

  const mode = games.some(g => g.source === "ESPN") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, games });
});

app.get("/api/pools", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const pools = db
    .prepare(`SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`)
    .all(today, tomorrow);

  const mode = pools.some(p => p.mode === "LIVE") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, poolResult, pools });
});

// keep compatibility
app.get("/api/pool", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const pools = db
    .prepare(`SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`)
    .all(today, tomorrow);

  const mode = pools.some(p => p.mode === "LIVE") ? "LIVE" : "DEMO";
  res.json({ ok: true, mode, poolResult, pools });
});

app.get("/api/pool/:id", (req, res) => {
  const pool = getPoolOr404(req.params.id);
  if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });

  const game = getGameById(pool.gameId);
  const mode = pool.mode || "DEMO";
  res.json({ ok: true, mode, pool, game });
});

// ✅ Phase 2核心：pool roster endpoint (Lineup Builder 用)
app.get("/api/pool/:id/roster", (req, res) => {
  const pool = getPoolOr404(req.params.id);
  if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });

  const game = getGameById(pool.gameId);
  if (!game) return res.status(404).json({ ok: false, error: "Game not found" });

  const { home, away } = inferTeamsFromGame(game);
  if (!home || !away) {
    return res.json({
      ok: true,
      mode: pool.mode || "DEMO",
      pool,
      game,
      teams: { home, away },
      players: [],
      note: "Teams not seeded for these codes yet."
    });
  }

  // Use roster_players snapshot for pool.date (Alpha single source of truth)
  const players = db.prepare(`
    SELECT
      p.playerId, p.fullName, p.pos, p.teamId, p.price,
      t.code as teamCode, t.name as teamName
    FROM roster_players rp
    JOIN players p ON p.playerId = rp.playerId
    JOIN teams t ON t.teamId = rp.teamId
    WHERE rp.date = ? AND rp.teamId IN (?, ?)
      AND p.isActive = 1
    ORDER BY rp.teamId ASC, p.price DESC, p.fullName ASC
  `).all(pool.date, home.teamId, away.teamId);

  res.json({
    ok: true,
    mode: pool.mode || "DEMO",
    pool,
    game,
    teams: { home, away },
    rules: { salaryCap: pool.salaryCap, rosterSize: pool.rosterSize },
    players
  });
});

// ✅ Submit entry (Phase 2：先用匿名 entryId，之後接 OAuth/user)
app.post("/api/entry", (req, res) => {
  try {
    const { poolId, playerIds } = req.body || {};
    if (!poolId || !Array.isArray(playerIds)) {
      return res.status(400).json({ ok: false, error: "poolId and playerIds required" });
    }

    const pool = getPoolOr404(poolId);
    if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });

    // Basic validations
    const uniqueIds = Array.from(new Set(playerIds.filter(Boolean)));
    if (uniqueIds.length !== pool.rosterSize) {
      return res.status(400).json({
        ok: false,
        error: `Roster must be exactly ${pool.rosterSize} unique players`
      });
    }

    // Pull players + prices + team check from roster snapshot (pool.date)
    const rows = db.prepare(`
      SELECT p.playerId, p.teamId, p.price
      FROM roster_players rp
      JOIN players p ON p.playerId = rp.playerId
      WHERE rp.date = ? AND p.playerId IN (${uniqueIds.map(() => "?").join(",")})
        AND p.isActive = 1
    `).all(pool.date, ...uniqueIds);

    if (rows.length !== uniqueIds.length) {
      return res.status(400).json({
        ok: false,
        error: "Some players are invalid for this pool/date (not in roster snapshot)"
      });
    }

    const totalCost = rows.reduce((sum, r) => sum + (r.price || 0), 0);
    if (totalCost > pool.salaryCap) {
      return res.status(400).json({
        ok: false,
        error: `Over salary cap: ${totalCost} > ${pool.salaryCap}`,
        totalCost,
        salaryCap: pool.salaryCap
      });
    }

    const entryId = `e_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const createdAt = nowIso();

    const insertEntry = db.prepare(`
      INSERT INTO entries (entryId, poolId, createdAt, totalCost, rosterSize, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertEP = db.prepare(`
      INSERT INTO entry_players (entryId, playerId, teamId, price)
      VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertEntry.run(entryId, poolId, createdAt, totalCost, pool.rosterSize, "submitted");
      for (const r of rows) {
        insertEP.run(entryId, r.playerId, r.teamId, r.price);
      }
    });
    tx();

    res.json({
      ok: true,
      mode: pool.mode || "DEMO",
      entry: { entryId, poolId, createdAt, totalCost, rosterSize: pool.rosterSize }
    });
  } catch (e) {
    console.error("POST /api/entry error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ✅ List entries for a pool (方便你驗證)
app.get("/api/pool/:id/entries", (req, res) => {
  try {
    const pool = getPoolOr404(req.params.id);
    if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });

    const entries = db.prepare(`
      SELECT * FROM entries
      WHERE poolId = ?
      ORDER BY createdAt DESC
      LIMIT 50
    `).all(pool.id);

    res.json({ ok: true, mode: pool.mode || "DEMO", poolId: pool.id, entries });
  } catch (e) {
    console.error("GET /api/pool/:id/entries error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ✅ Entry detail (含球員列表)
app.get("/api/entry/:entryId", (req, res) => {
  try {
    const entry = db.prepare(`SELECT * FROM entries WHERE entryId = ?`).get(req.params.entryId);
    if (!entry) return res.status(404).json({ ok: false, error: "Entry not found" });

    const players = db.prepare(`
      SELECT ep.playerId, ep.teamId, ep.price, p.fullName, p.pos, t.code as teamCode
      FROM entry_players ep
      JOIN players p ON p.playerId = ep.playerId
      LEFT JOIN teams t ON t.teamId = ep.teamId
      WHERE ep.entryId = ?
      ORDER BY ep.price DESC, p.fullName ASC
    `).all(entry.entryId);

    res.json({ ok: true, entry, players });
  } catch (e) {
    console.error("GET /api/entry/:entryId error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Admin routes ----------
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

// ✅ Seed teams/players/rosters into DB (you already tested this)
app.get("/api/admin/seed-players", (req, res) => {
  try {
    const result = seedPlayers();
    res.json({ ok: true, result });
  } catch (e) {
    console.error("seed-players error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Frontend static ----------
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ---------- Start ----------
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
