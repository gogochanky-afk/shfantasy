const express = require("express");
const { initDb } = require("./db-init");

const app = express();
app.use(express.json());

const db = initDb();

//
// ===== DEMO PLAYERS (Alpha hardcoded) =====
//
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
  { id: "p10", name: "Kyrie Irving", cost: 2 }
];

//
// ===== ROOT =====
//
app.get("/", (req, res) => {
  res.send("SH Fantasy Backend Running 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

//
// ===== PLAYERS =====
//
app.get("/api/players", (req, res) => {
  res.json({ mode: "DEMO", players: DEMO_PLAYERS });
});

//
// ===== JOIN POOL =====
//
app.post("/api/join", (req, res) => {
  const { poolId, username } = req.body;

  if (!poolId || !username) {
    return res.status(400).json({ error: "Missing poolId or username" });
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
    username
  });
});

//
// ===== SAVE LINEUP =====
//
app.post("/api/lineup", (req, res) => {
  const { entryId, poolId, username, players } = req.body;

  if (!entryId || !players || players.length !== 5) {
    return res.status(400).json({ error: "Invalid lineup" });
  }

  const selectedPlayers = DEMO_PLAYERS.filter(p =>
    players.includes(p.id)
  );

  const totalCost = selectedPlayers.reduce((sum, p) => sum + p.cost, 0);

  if (totalCost > 10) {
    return res.status(400).json({ error: "Salary cap exceeded" });
  }

  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lineups
    (entryId, poolId, username, playersJson, totalCost, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entryId,
    poolId,
    username,
    JSON.stringify(players),
    totalCost,
    now,
    now
  );

  res.json({ ok: true, totalCost });
});

//
// ===== GET LINEUP =====
//
app.get("/api/lineup", (req, res) => {
  const { entryId } = req.query;

  if (!entryId) {
    return res.status(400).json({ error: "Missing entryId" });
  }

  const stmt = db.prepare(`
    SELECT * FROM lineups WHERE entryId = ?
  `);

  const lineup = stmt.get(entryId);

  if (!lineup) {
    return res.json({ ok: true, lineup: null });
  }

  res.json({
    ok: true,
    lineup: {
      ...lineup,
      players: JSON.parse(lineup.playersJson)
    }
  });
});

//
// ===== SERVER =====
//
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
