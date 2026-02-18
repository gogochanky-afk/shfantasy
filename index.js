const path = require("path");
const express = require("express");
const { initDb } = require("./db-init");

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

const db = initDb();

// ===== DEMO POOLS =====
const DEMO_POOLS = [
  { id: "demo-today", name: "Today Arena", salaryCap: 10, rosterSize: 5, date: "today" },
  { id: "demo-tomorrow", name: "Tomorrow Arena", salaryCap: 10, rosterSize: 5, date: "tomorrow" },
];

// ===== DEMO PLAYERS (expand + mixed costs 1-4) =====
const DEMO_PLAYERS = [
  // cost 4 (stars)
  { id: "p1", name: "Nikola Jokic", cost: 4 },
  { id: "p2", name: "Luka Doncic", cost: 4 },
  { id: "p3", name: "Giannis Antetokounmpo", cost: 4 },
  { id: "p4", name: "Shai Gilgeous-Alexander", cost: 4 },
  { id: "p5", name: "Joel Embiid", cost: 4 },

  // cost 3 (all-stars)
  { id: "p6", name: "Stephen Curry", cost: 3 },
  { id: "p7", name: "Kevin Durant", cost: 3 },
  { id: "p8", name: "Jayson Tatum", cost: 3 },
  { id: "p9", name: "LeBron James", cost: 3 },
  { id: "p10", name: "Anthony Davis", cost: 3 },
  { id: "p11", name: "Kyrie Irving", cost: 3 },
  { id: "p12", name: "Jimmy Butler", cost: 3 },

  // cost 2 (solid starters)
  { id: "p13", name: "Ja Morant", cost: 2 },
  { id: "p14", name: "Devin Booker", cost: 2 },
  { id: "p15", name: "Damian Lillard", cost: 2 },
  { id: "p16", name: "Donovan Mitchell", cost: 2 },
  { id: "p17", name: "Bam Adebayo", cost: 2 },

  // cost 1 (value picks)
  { id: "p18", name: "Derrick White", cost: 1 },
  { id: "p19", name: "Mikal Bridges", cost: 1 },
  { id: "p20", name: "Jarrett Allen", cost: 1 },
  { id: "p21", name: "Aaron Gordon", cost: 1 },
  { id: "p22", name: "Austin Reaves", cost: 1 },
];

// ===== ROOT / HEALTH =====
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===== POOLS =====
app.get("/api/pools", (req, res) => {
  res.json({ mode: "DEMO", pools: DEMO_POOLS });
});

// ===== PLAYERS =====
app.get("/api/players", (req, res) => {
  res.json({ mode: "DEMO", players: DEMO_PLAYERS });
});

// ===== JOIN POOL => create entry =====
app.post("/api/join", (req, res) => {
  const { poolId, username } = req.body || {};
  if (!poolId || !username) {
    return res.status(400).json({ ok: false, error: "poolId and username required" });
  }

  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO entries (poolId, username, createdAt)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(poolId, username, createdAt);

  res.json({
    ok: true,
    entryId: result.lastInsertRowid,
    poolId,
    username,
    createdAt,
  });
});

// ===== MY ENTRIES =====
app.get("/api/my-entries", (req, res) => {
  const username = (req.query.username || "").toString().trim();
  if (!username) {
    return res.status(400).json({ ok: false, error: "username required" });
  }

  const rows = db
    .prepare(`SELECT id, poolId, username, createdAt FROM entries WHERE username = ? ORDER BY id DESC`)
    .all(username);

  res.json({ ok: true, mode: "DEMO", username, entries: rows });
});

// ===== SAVE LINEUP =====
app.post("/api/lineup", (req, res) => {
  const { entryId, poolId, username, players } = req.body || {};

  if (!entryId || !poolId || !username || !Array.isArray(players)) {
    return res.status(400).json({ ok: false, error: "entryId, poolId, username, players required" });
  }

  if (players.length !== 5) {
    return res.status(400).json({ ok: false, error: "Roster must be exactly 5 players" });
  }

  const selectedPlayers = DEMO_PLAYERS.filter((p) => players.includes(p.id));
  const totalCost = selectedPlayers.reduce((sum, p) => sum + (p.cost || 0), 0);

  if (totalCost > 10) {
    return res.status(400).json({ ok: false, error: "Over salary cap" });
  }

  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lineups
    (entryId, poolId, username, playersJson, totalCost, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // If lineup existed, keep original createdAt if possible
  const existing = db.prepare(`SELECT createdAt FROM lineups WHERE entryId = ?`).get(entryId);
  const createdAt = existing?.createdAt || now;

  stmt.run(
    entryId,
    poolId,
    username,
    JSON.stringify(players),
    totalCost,
    createdAt,
    now
  );

  res.json({ ok: true, totalCost });
});

// ===== GET LINEUP =====
app.get("/api/lineup", (req, res) => {
  const entryId = (req.query.entryId || "").toString().trim();
  if (!entryId) {
    return res.status(400).json({ ok: false, error: "entryId required" });
  }

  const row = db.prepare(`SELECT * FROM lineups WHERE entryId = ?`).get(entryId);

  if (!row) {
    return res.json({ ok: true, lineup: null });
  }

  let players = [];
  try {
    players = JSON.parse(row.playersJson || "[]");
  } catch (e) {}

  res.json({
    ok: true,
    lineup: {
      entryId: row.entryId,
      poolId: row.poolId,
      username: row.username,
      totalCost: row.totalCost,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      players,
    },
  });
});

// ===== SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
