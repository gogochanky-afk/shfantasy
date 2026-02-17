const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

/* ================================
   DATABASE INIT
================================ */

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "shfantasy.db");

const db = new Database(DB_PATH);

// --- CREATE TABLES ---
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  homeTeam TEXT,
  awayTeam TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gameId INTEGER,
  players TEXT,
  totalSalary INTEGER,
  score INTEGER DEFAULT 0,
  createdAt TEXT
);
`);

/* ================================
   SEED DEMO GAME
================================ */

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const today = isoDate(new Date());

const gameCount = db.prepare(
  "SELECT COUNT(*) as c FROM games WHERE date = ?"
).get(today).c;

if (gameCount === 0) {
  db.prepare(`
    INSERT INTO games (date, homeTeam, awayTeam, status)
    VALUES (?, ?, ?, ?)
  `).run(today, "Lakers", "Warriors", "scheduled");
}

/* ================================
   ROUTES
================================ */

app.get("/api/games", (req, res) => {
  try {
    const games = db
      .prepare("SELECT * FROM games ORDER BY id DESC")
      .all();
    res.json({ games });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/entries", (req, res) => {
  try {
    const { gameId, players, totalSalary } = req.body;

    db.prepare(`
      INSERT INTO entries (gameId, players, totalSalary, createdAt)
      VALUES (?, ?, ?, ?)
    `).run(
      gameId,
      JSON.stringify(players),
      totalSalary,
      new Date().toISOString()
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/leaderboard", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM entries ORDER BY score DESC")
      .all();
    res.json({ leaderboard: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================================
   START
================================ */

app.listen(port, () => {
  console.log(`SH Fantasy running on ${port}`);
});
