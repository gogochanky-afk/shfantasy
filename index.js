const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// =======================
// Database
// =======================

const db = new Database("data.db");

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
  players TEXT,
  totalSalary INTEGER,
  score INTEGER DEFAULT 0,
  createdAt TEXT
);
`);

// Seed demo game
const gameCount = db.prepare("SELECT COUNT(*) as count FROM games").get().count;

if (gameCount === 0) {
  db.prepare(`
    INSERT INTO games (date, homeTeam, awayTeam, status)
    VALUES (?, ?, ?, ?)
  `).run("2026-02-17", "Lakers", "Warriors", "scheduled");
}

// =======================
// API
// =======================

app.get("/api/games", (req, res) => {
  const games = db.prepare("SELECT * FROM games").all();
  res.json({ games });
});

app.get("/api/roster", (req, res) => {
  const players = [
    { playerId: 1, name: "LeBron James", salary: 4 },
    { playerId: 2, name: "Stephen Curry", salary: 4 },
    { playerId: 3, name: "Anthony Davis", salary: 3 },
    { playerId: 4, name: "Klay Thompson", salary: 2 },
    { playerId: 5, name: "Austin Reaves", salary: 1 },
    { playerId: 6, name: "Draymond Green", salary: 2 }
  ];
  res.json({ players });
});

app.post("/api/entry", (req, res) => {
  const { players, totalSalary } = req.body;

  const stmt = db.prepare(`
    INSERT INTO entries (players, totalSalary, createdAt)
    VALUES (?, ?, ?)
  `);

  stmt.run(JSON.stringify(players), totalSalary, new Date().toISOString());

  res.json({ success: true });
});

app.get("/api/leaderboard", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM entries
    ORDER BY id DESC
  `).all();

  res.json({ leaderboard: rows });
});

// =======================
// Serve frontend
// =======================

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// =======================

app.listen(port, () => {
  console.log("Server running on port", port);
});
