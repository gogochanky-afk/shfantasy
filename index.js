// /index.js
const express = require("express");
const path = require("path");
const { initDb } = require("./db-init");

const app = express();
app.use(express.json());

// ---- DB ----
const db = initDb();

// ---- DEMO DATA (Alpha hardcoded) ----
const DEMO_POOLS = [
  { id: "demo-today", name: "Today Arena", salaryCap: 10, rosterSize: 5, date: "today" },
  { id: "demo-tomorrow", name: "Tomorrow Arena", salaryCap: 10, rosterSize: 5, date: "tomorrow" },
];

const DEMO_PLAYERS = [
  { id: "p1", name: "LeBron James", cost: 3 },
  { id: "p2", name: "Stephen Curry", cost: 3 },
  { id: "p3", name: "Kevin Durant", cost: 3 },
  { id: "p4", name: "Jayson Tatum", cost: 2 },
  { id: "p5", name: "Anthony Davis", cost: 2 },
  { id: "p6", name: "Luka Doncic", cost: 3 },
  { id: "p7", name: "Nikola Jokic", cost: 3 },
  { id: "p8", name: "Ja Morant", cost: 2 },
  { id: "p9", name: "Jimmy Butler", cost: 2 },
  { id: "p10", name: "Kyrie Irving", cost: 2 },
];

// ---- API: health ----
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ---- API: pools ----
app.get("/api/pools", (req, res) => {
  res.json({ mode: "DEMO", pools: DEMO_POOLS });
});

// ---- API: players ----
app.get("/api/players", (req, res) => {
  res.json({ mode: "DEMO", players: DEMO_PLAYERS });
});

// ---- API: join pool -> create entry ----
app.post("/api/join", (req, res) => {
  const { poolId, username } = req.body || {};
  if (!poolId || !username) return res.status(400).json({ error: "poolId and username required" });

  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO entries (poolId, username, createdAt)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(poolId, username, createdAt);

  res.json({ ok: true, mode: "DEMO", entryId: result.lastInsertRowid, poolId, username });
});

// ---- API: my entries ----
app.get("/api/my-entries", (req, res) => {
  const username = (req.query.username || "").trim();
  if (!username) return res.status(400).json({ error: "username required" });

  const rows = db
    .prepare(`SELECT id, poolId, username, createdAt FROM entries WHERE username = ? ORDER BY id DESC`)
    .all(username);

  res.json({ ok: true, mode: "DEMO", username, entries: rows });
});

// ---- API: save lineup (5 players, salary cap enforced) ----
app.post("/api/lineup", (req, res) => {
  const { entryId, poolId, username, players } = req.body || {};

  if (!entryId || !poolId || !username || !Array.isArray(players)) {
    return res.status(400).json({ error: "entryId, poolId, username, players[] required" });
  }
  if (players.length !== 5) return res.status(400).json({ error: "Must pick exactly 5 players" });

  // validate players & cost
  const selected = DEMO_PLAYERS.filter((p) => players.includes(p.id));
  if (selected.length !== 5) return res.status(400).json({ error: "Invalid player ids" });

  const totalCost = selected.reduce((sum, p) => sum + p.cost, 0);
  if (totalCost > 10) return res.status(400).json({ error: "Over salary cap (10)" });

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lineups
    (entryId, poolId, username, playersJson, totalCost, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(entryId, poolId, username, JSON.stringify(players), totalCost, now, now);

  res.json({ ok: true, totalCost });
});

// ---- API: get lineup by entryId ----
app.get("/api/lineup", (req, res) => {
  const entryId = req.query.entryId;
  if (!entryId) return res.status(400).json({ error: "entryId required" });

  const row = db.prepare(`SELECT * FROM lineups WHERE entryId = ?`).get(entryId);
  if (!row) return res.json({ ok: true, lineup: null });

  res.json({
    ok: true,
    lineup: {
      ...row,
      players: JSON.parse(row.playersJson),
    },
  });
});

// ---- Serve frontend (public/) ----
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Root -> always show frontend
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/my-entries", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "my-entries.html")));
app.get("/draft", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "draft.html")));

// Fallback: if user hits random route, return index.html (avoid blank white)
app.get("*", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

// ---- Server ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
