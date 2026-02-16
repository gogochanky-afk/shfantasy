// index.js - SH Fantasy (Cloud Run)
// Stable: health, ping, status, demo fallback APIs

const express = require("express");
const path = require("path");
const fs = require("fs");

let Database;
try {
  Database = require("better-sqlite3");
} catch (e) {
  // If better-sqlite3 fails to load (shouldn't in prod), we still run without DB.
  Database = null;
}

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// -----------------------------
// Boot logs (Cloud Run)
// -----------------------------
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);

// -----------------------------
// DB setup (app_meta for status)
// -----------------------------
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "shfantasy.db");
let db = null;
let db_ok = false;

function initDb() {
  if (!Database) {
    console.log("DB: better-sqlite3 not available, running without DB.");
    db = null;
    db_ok = false;
    return;
  }
  try {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // lightweight sanity
    db.prepare("SELECT 1").get();
    db_ok = true;
    console.log("DB: OK ->", DB_PATH);
  } catch (e) {
    db_ok = false;
    db = null;
    console.error("DB: FAILED ->", e?.message || e);
  }
}

function metaGet(key) {
  if (!db) return null;
  try {
    const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key);
    return row ? row.value : null;
  } catch (e) {
    return null;
  }
}

function metaSet(key, value) {
  if (!db) return false;
  try {
    db.prepare(
      "INSERT INTO app_meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

initDb();

// -----------------------------
// Frontend static (if exists)
// -----------------------------
const frontendDist = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  console.log("FRONTEND: serving static ->", frontendDist);
} else {
  console.log("FRONTEND: dist not found (ok for backend-only)");
}

// -----------------------------
// Health + Ping
// -----------------------------
app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/ping", (req, res) => res.status(200).json({ ok: true, message: "pong" }));

// -----------------------------
// Demo data helpers
// -----------------------------
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function demoGamesFor(dateStr) {
  // NOTE: these teamIds are DEMO placeholders
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

function demoPoolsFromGames(games) {
  // Deterministic pool id = `${date}-${gameId}`
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
      mode: "DEMO",
    };
  });
}

// -----------------------------
// Data mode decision (for now)
// -----------------------------
// Today: always DEMO unless you later flip LIVE_MODE=1 and implement real sync.
// This keeps app stable while we build B/C.
function getDataMode() {
  // future: LIVE_MODE=1 will switch to live schedule/roster logic
  const live = String(process.env.LIVE_MODE || "").trim() === "1";
  return live ? "LIVE" : "DEMO";
}

// -----------------------------
// STATUS endpoint (Phase A)
// -----------------------------
app.get("/api/status", (req, res) => {
  const mode = getDataMode();

  // these will be populated in Phase B/C by calling metaSet()
  const lastScheduleSync = metaGet("last_schedule_sync") || null;
  const lastRosterSync = metaGet("last_roster_sync") || null;

  res.status(200).json({
    ok: true,
    service: "shfantasy",
    mode,
    dataMode: mode, // keep both keys for convenience
    db: {
      ok: !!db_ok,
      path: DB_PATH,
    },
    sync: {
      last_schedule_sync: lastScheduleSync,
      last_roster_sync: lastRosterSync,
    },
    now: new Date().toISOString(),
    version: process.env.K_REVISION || "local",
  });
});

// -----------------------------
// API: Games (today + tomorrow)
// -----------------------------
app.get("/api/games", (req, res) => {
  // For now DEMO only.
  // Phase B will replace this with DB-backed real schedule (with fallback to demo).
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

  const games = [
    ...demoGamesFor(isoDate(today)),
    ...demoGamesFor(isoDate(tomorrow)),
  ];

  res.status(200).json({
    ok: true,
    mode: "DEMO",
    games,
  });
});

// -----------------------------
// API: Pools (from games)
// -----------------------------
app.get("/api/pools", (req, res) => {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

  const games = [
    ...demoGamesFor(isoDate(today)),
    ...demoGamesFor(isoDate(tomorrow)),
  ];
  const pools = demoPoolsFromGames(games);

  res.status(200).json({
    ok: true,
    mode: "DEMO",
    pools,
  });
});

// -----------------------------
// Root route
// -----------------------------
app.get("/", (req, res) => {
  if (fs.existsSync(frontendDist)) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }
  // backend-only fallback
  res
    .status(200)
    .send("Backend is running (frontend not built). Try /api/status or /api/games or /api/pools");
});

// -----------------------------
// Start server
// -----------------------------
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
