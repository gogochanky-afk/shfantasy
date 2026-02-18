const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());

// ---------- DB (SQLite) ----------
const DB_PATH = path.join(__dirname, "shfantasy.db");
const db = new Database(DB_PATH);

// Ensure tables exist
db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pool_id TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_user_time ON entries(username, created_at);
CREATE INDEX IF NOT EXISTS idx_entries_pool_time ON entries(pool_id, created_at);
`);

// ---------- Demo Pools (Today + Tomorrow) ----------
function getDemoPools() {
  return [
    { id: "demo-today", name: "Today Arena", salaryCap: 10, rosterSize: 5, date: "today" },
    { id: "demo-tomorrow", name: "Tomorrow Arena", salaryCap: 10, rosterSize: 5, date: "tomorrow" },
  ];
}

// ---------- API ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/pools", (req, res) => {
  res.json({ mode: "DEMO", pools: getDemoPools() });
});

// Join a pool -> create an entry record
app.post("/api/join", (req, res) => {
  try {
    const { poolId, username } = req.body || {};
    if (!poolId || !username) {
      return res.status(400).json({ ok: false, error: "poolId and username are required" });
    }

    const pools = getDemoPools();
    const exists = pools.some((p) => p.id === poolId);
    if (!exists) {
      return res.status(404).json({ ok: false, error: "Pool not found" });
    }

    const stmt = db.prepare(
      `INSERT INTO entries (pool_id, username) VALUES (?, ?)`
    );
    const info = stmt.run(poolId, String(username).trim());

    return res.json({
      ok: true,
      entry: { id: info.lastInsertRowid, poolId, username: String(username).trim() },
    });
  } catch (e) {
    console.error("JOIN_ERROR", e);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

// My Entries (by username)
app.get("/api/my-entries", (req, res) => {
  try {
    const username = (req.query.username || "").toString().trim();
    if (!username) {
      return res.status(400).json({ ok: false, error: "username is required" });
    }

    const rows = db
      .prepare(
        `SELECT id, pool_id as poolId, username, created_at as createdAt
         FROM entries
         WHERE username = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 200`
      )
      .all(username);

    res.json({ ok: true, mode: "DEMO", username, entries: rows });
  } catch (e) {
    console.error("MY_ENTRIES_ERROR", e);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

// ---------- Static Frontend ----------
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/my-entries", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "my-entries.html"));
});

// Fallback: if user hits unknown path, go home
app.get("*", (req, res) => {
  res.redirect("/");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
