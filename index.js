const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// =====================
// DATABASE SETUP
// =====================

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "fantasy.db");
const db = new Database(DB_PATH);

// Create games table
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  homeTeam TEXT,
  awayTeam TEXT,
  status TEXT
);
`);

// Create entries table
db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poolId TEXT,
  players TEXT,
  totalSalary INTEGER,
  score INTEGER DEFAULT 0,
  createdAt TEXT
);
`);

// =====================
// SEED DEMO DATA
// =====================

const existing = db.prepare("SELECT COUNT(*) as count FROM games").get();

if (existing.count === 0) {
  const insert = db.prepare(`
    INSERT INTO games (date, homeTeam, awayTeam, status)
    VALUES (?, ?, ?, ?)
  `);

  insert.run("2026-02-17", "Lakers", "Warriors", "scheduled");
  insert.run("2026-02-17", "Celtics", "Bucks", "scheduled");
}

// =====================
// API ROUTES
// =====================

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// get games
app.get("/api/games", (req, res) => {
  const games = db.prepare("SELECT * FROM games").all();
  res.json({ games });
});

// get leaderboard
app.get("/api/leaderboard", (req, res) => {
  const rows = db.prepare(`
    SELECT id, score
    FROM entries
    ORDER BY score DESC
    LIMIT 20
  `).all();

  res.json({ leaderboard: rows });
});

// =====================
// SERVE FRONTEND
// =====================

const frontendPath = path.join(__dirname, "../frontend/dist");

app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// =====================

app.listen(port, () => {
  console.log("Server running on port", port);
});
