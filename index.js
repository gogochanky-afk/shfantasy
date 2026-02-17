const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.sqlite");
const db = new Database(DB_PATH);

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poolId TEXT,
  players TEXT,
  totalSalary INTEGER,
  score INTEGER,
  createdAt TEXT
);
`);

function ensurePoolsForTodayTomorrow() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const games = db.prepare(`
    SELECT * FROM games WHERE date IN (?, ?)
  `).all(today, tomorrow);

  const upsert = db.prepare(`
    INSERT INTO pools (id, gameId, date, name, lockAt, salaryCap, rosterSize, entryFee, prize, mode, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      lockAt=excluded.lockAt,
      updatedAt=excluded.updatedAt
  `);

  const nowIso = new Date().toISOString();

  for (const g of games) {
    const id = `${g.date}-${g.gameId}`;
    const name = `Daily Blitz: ${g.awayCode} @ ${g.homeCode}`;

    upsert.run(
      id,
      g.gameId,
      g.date,
      name,
      g.startAt,
      10,
      5,
      5,
      100,
      "DEMO",
      nowIso
    );
  }
}

app.get("/api/pools", (req, res) => {
  ensurePoolsForTodayTomorrow();

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  const pools = db.prepare(`
    SELECT * FROM pools WHERE date IN (?, ?)
  `).all(today, tomorrow);

  res.json({ ok: true, mode: "DEMO", pools });
});

app.get("/api/roster", (req, res) => {
  const players = db.prepare(`
    SELECT * FROM players WHERE isActive = 1
  `).all();

  res.json({ ok: true, players });
});

app.post("/api/entry", (req, res) => {
  const { poolId, players, totalSalary } = req.body;

  if (!poolId || !players || players.length !== 5) {
    return res.status(400).json({ ok: false, error: "Invalid entry" });
  }

  const score = Math.floor(Math.random() * 120); // mock scoring

  db.prepare(`
    INSERT INTO entries (poolId, players, totalSalary, score, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    poolId,
    JSON.stringify(players),
    totalSalary,
    score,
    new Date().toISOString()
  );

  res.json({ ok: true, score });
});

app.get("/api/leaderboard/:poolId", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM entries WHERE poolId = ?
    ORDER BY score DESC
  `).all(req.params.poolId);

  res.json({ ok: true, leaderboard: rows });
});

const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(port, () => {
  console.log("Server started on", port);
});
