const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---------------- DB ----------------
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.sqlite");
const db = new Database(DB_PATH);

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

// ---------------- Schema ----------------
db.exec(`
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
  isActive INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS games (
  gameId TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  startAt TEXT,
  homeCode TEXT,
  awayCode TEXT
);

CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  gameId TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT,
  lockAt TEXT,
  salaryCap INTEGER DEFAULT 10,
  rosterSize INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  poolId TEXT NOT NULL,
  players TEXT NOT NULL,
  totalCredits INTEGER,
  createdAt TEXT
);
`);

// ---------------- DEMO SEED ----------------
function seedDemo() {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));

  db.prepare(`DELETE FROM teams`).run();
  db.prepare(`DELETE FROM players`).run();
  db.prepare(`DELETE FROM games`).run();
  db.prepare(`DELETE FROM pools`).run();

  db.prepare(`INSERT INTO teams VALUES (1,'GSW','Warriors')`).run();
  db.prepare(`INSERT INTO teams VALUES (2,'LAL','Lakers')`).run();

  const insertPlayer = db.prepare(`
    INSERT INTO players (playerId,fullName,pos,teamId,price)
    VALUES (?,?,?,?,?)
  `);

  for (let i = 1; i <= 10; i++) {
    insertPlayer.run(`p${i}`, `Player ${i}`, "G", i <= 5 ? 1 : 2, 2);
  }

  db.prepare(`
    INSERT INTO games VALUES ('g1', ?, ?, 'GSW', 'LAL')
  `).run(today, new Date().toISOString());

  db.prepare(`
    INSERT INTO pools VALUES (?, 'g1', ?, 'Daily Blitz: GSW @ LAL', ?, 10, 5)
  `).run(`${today}-g1`, today, new Date().toISOString());
}

seedDemo();

// ---------------- API ----------------

app.get("/api/pools", (req, res) => {
  const pools = db.prepare(`SELECT * FROM pools`).all();
  res.json({ ok: true, pools });
});

app.get("/api/players", (req, res) => {
  const players = db.prepare(`SELECT * FROM players WHERE isActive=1`).all();
  res.json({ ok: true, players });
});

app.post("/api/entries", (req, res) => {
  const { poolId, players } = req.body;

  if (!poolId || !players || players.length !== 5) {
    return res.status(400).json({ ok: false, error: "Invalid entry" });
  }

  const rows = db
    .prepare(`SELECT * FROM players WHERE playerId IN (${players.map(() => "?").join(",")})`)
    .all(...players);

  const totalCredits = rows.reduce((sum, p) => sum + p.price, 0);

  if (totalCredits > 10) {
    return res.status(400).json({ ok: false, error: "Over salary cap" });
  }

  const id = `${poolId}-${Date.now()}`;

  db.prepare(`
    INSERT INTO entries VALUES (?,?,?,?,?)
  `).run(id, poolId, JSON.stringify(players), totalCredits, new Date().toISOString());

  res.json({ ok: true, id, totalCredits });
});

app.get("/api/entries/:poolId", (req, res) => {
  const rows = db.prepare(`SELECT * FROM entries WHERE poolId=?`).all(req.params.poolId);
  res.json({ ok: true, rows });
});

// ---------------- Frontend ----------------
const frontendDist = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(port, () => {
  console.log("Server running on port", port);
});
