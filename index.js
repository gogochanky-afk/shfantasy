const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

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
  `);
}
ensureSchema();

// ---------- DEMO fallback games (always available) ----------
function demoGamesFor(dateStr) {
  // fixed teams for now; later we will replace with real schedule source
  const demo = [
    {
      gameId: `demo-${dateStr}-001`,
      date: dateStr,
      startAt: new Date(`${dateStr}T11:00:00.000Z`).toISOString(),
      status: "scheduled",
      homeCode: "LAL",
      homeName: "Lakers",
      awayCode: "GSW",
      awayName: "Warriors",
      source: "DEMO",
    },
    {
      gameId: `demo-${dateStr}-002`,
      date: dateStr,
      startAt: new Date(`${dateStr}T13:30:00.000Z`).toISOString(),
      status: "scheduled",
      homeCode: "BOS",
      homeName: "Celtics",
      awayCode: "MIA",
      awayName: "Heat",
      source: "DEMO",
    },
  ];
  return demo;
}

function upsertGames(games) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO games (gameId, date, startAt, status, homeCode, homeName, awayCode, awayName, source, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(gameId) DO UPDATE SET
      date=excluded.date,
      startAt=excluded.startAt,
      status=excluded.status,
      homeCode=excluded.homeCode,
      homeName=excluded.homeName,
      awayCode=excluded.awayCode,
      awayName=excluded.awayName,
      source=excluded.source,
      updatedAt=excluded.updatedAt
  `);

  let count = 0;
  const tx = db.transaction(() => {
    for (const g of games) {
      stmt.run(
        g.gameId,
        g.date,
        g.startAt || null,
        g.status || null,
        g.homeCode || null,
        g.homeName || null,
        g.awayCode || null,
        g.awayName || null,
        g.source || "DEMO",
        nowIso
      );
      count++;
    }
  });
  tx();
  return count;
}

// Ensure games for today+tomorrow exist in DB (fallback to demo if empty)
function ensureGamesForTodayTomorrow() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const existing = db
    .prepare(`SELECT * FROM games WHERE date IN (?, ?) LIMIT 1`)
    .get(today, tomorrow);

  if (existing) return { ok: true, source: "DB", dates: [today, tomorrow] };

  const demo = [...demoGamesFor(today), ...demoGamesFor(tomorrow)];
  upsertGames(demo);
  return { ok: true, source: "DEMO_FALLBACK", dates: [today, tomorrow] };
}

// ---------- Pool generation (deterministic) ----------
function ensurePoolsForTodayTomorrow() {
  ensureGamesForTodayTomorrow();

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

  const nowIso = new Date().toISOString();
  let count = 0;

  const tx = db.transaction(() => {
    for (const g of games) {
      const id = `${g.date}-${g.gameId}`;
      const name = `Daily Blitz: ${g.awayCode || "AWAY"} @ ${g.homeCode || "HOME"}`;
      const lockAt = g.startAt || new Date().toISOString();
      const mode = g.source === "LIVE" ? "LIVE" : "DEMO";

      upsert.run(id, g.gameId, g.date, name, lockAt, 10, 5, 5, 100, mode, nowIso);
      count++;
    }
  });
  tx();

  return { ok: true, poolsUpserted: count, dates: [today, tomorrow] };
}

// ---------- API ----------
app.get("/api/ping", (req, res) => res.json({ ok: true, message: "pong" }));

app.get("/api/games", (req, res) => {
  ensureGamesForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const games = db
    .prepare(`SELECT * FROM games WHERE date IN (?, ?) ORDER BY date ASC, startAt ASC`)
    .all(today, tomorrow);

  res.json({ ok: true, mode: "DEMO", games });
});

app.get("/api/pools", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const pools = db
    .prepare(`SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`)
    .all(today, tomorrow);

  res.json({ ok: true, mode: "DEMO", poolResult, pools });
});

// Backward compatibility: your frontend sometimes calls /api/pool
app.get("/api/pool", (req, res) => {
  const poolResult = ensurePoolsForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const pools = db
    .prepare(`SELECT * FROM pools WHERE date IN (?, ?) ORDER BY date ASC, lockAt ASC`)
    .all(today, tomorrow);

  res.json({ ok: true, mode: "DEMO", poolResult, pools });
});

app.get("/api/pool/:id", (req, res) => {
  ensurePoolsForTodayTomorrow();
  const pool = db.prepare(`SELECT * FROM pools WHERE id = ?`).get(req.params.id);
  if (!pool) return res.status(404).json({ ok: false, error: "Pool not found" });
  res.json({ ok: true, pool });
});

// Keep admin endpoint, but for now it just returns "not enabled"
app.get("/api/admin/sync-schedule", (req, res) => {
  res.json({
    ok: false,
    error: "SYNC_DISABLED",
    message:
      "Real schedule sync is disabled for now (SSL issue). We will switch to a stable source later.",
  });
});

// ---------- Frontend static ----------
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => res.sendFile(path.join(frontendDist, "index.html")));

app.listen(port, () => console.log(`Server listening on port ${port}`));
