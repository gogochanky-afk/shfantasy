const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ---- DEMO DATA (in-memory) ----
// Pools = Today + Tomorrow
const pools = [
  { id: "demo-today", name: "Today Arena", salaryCap: 10, rosterSize: 5, date: "today" },
  { id: "demo-tomorrow", name: "Tomorrow Arena", salaryCap: 10, rosterSize: 5, date: "tomorrow" },
];

// Roster (simple demo players)
const rosterByPool = {
  "demo-today": [
    { playerId: "p1", name: "LeBron James", team: "LAL", salary: 4 },
    { playerId: "p2", name: "Stephen Curry", team: "GSW", salary: 4 },
    { playerId: "p3", name: "Austin Reaves", team: "LAL", salary: 2 },
    { playerId: "p4", name: "Klay Thompson", team: "GSW", salary: 2 },
    { playerId: "p5", name: "Draymond Green", team: "GSW", salary: 2 },
    { playerId: "p6", name: "D'Angelo Russell", team: "LAL", salary: 2 },
  ],
  "demo-tomorrow": [
    { playerId: "p7", name: "Anthony Edwards", team: "MIN", salary: 4 },
    { playerId: "p8", name: "Luka Doncic", team: "DAL", salary: 4 },
    { playerId: "p9", name: "Naz Reid", team: "MIN", salary: 2 },
    { playerId: "p10", name: "Kyrie Irving", team: "DAL", salary: 3 },
    { playerId: "p11", name: "Rudy Gobert", team: "MIN", salary: 3 },
    { playerId: "p12", name: "Dereck Lively II", team: "DAL", salary: 2 },
  ],
};

// Entries (in-memory; ok for demo)
let entries = []; // { id, poolId, players:[...], totalSalary, score, createdAt }

function calcTotalSalary(picks, poolId) {
  const roster = rosterByPool[poolId] || [];
  const map = new Map(roster.map((p) => [p.playerId, p.salary]));
  return (picks || []).reduce((sum, pid) => sum + (map.get(pid) || 0), 0);
}

function randomScore() {
  // demo only (0-200)
  return Math.floor(Math.random() * 201);
}

// ---- API ----
app.get("/api/health", (req, res) => res.json({ status: "ok", mode: "DEMO" }));

app.get("/api/pools", (req, res) => {
  res.json({ mode: "DEMO", pools });
});

app.get("/api/pools/:id", (req, res) => {
  const pool = pools.find((p) => p.id === req.params.id);
  if (!pool) return res.status(404).json({ error: "Pool not found" });
  res.json({ mode: "DEMO", pool });
});

app.get("/api/roster", (req, res) => {
  const poolId = req.query.poolId;
  const players = rosterByPool[poolId] || [];
  res.json({ mode: "DEMO", poolId, players });
});

// Optional: your /api/games endpoint (keep it simple)
app.get("/api/games", (req, res) => {
  res.json({
    games: [
      { id: 1, date: "2026-02-17", homeTeam: "Lakers", awayTeam: "Warriors", status: "scheduled" },
    ],
  });
});

// Submit entry
app.post("/api/entries", (req, res) => {
  const { poolId, players } = req.body || {};
  const pool = pools.find((p) => p.id === poolId);
  if (!pool) return res.status(400).json({ error: "Invalid poolId" });

  const picks = Array.isArray(players) ? players : [];
  if (picks.length !== pool.rosterSize) {
    return res.status(400).json({ error: `Must pick exactly ${pool.rosterSize} players` });
  }

  const totalSalary = calcTotalSalary(picks, poolId);
  if (totalSalary > pool.salaryCap) {
    return res.status(400).json({ error: `Salary cap exceeded: ${totalSalary} > ${pool.salaryCap}` });
  }

  const entry = {
    id: `e_${Date.now()}`,
    poolId,
    players: picks,
    totalSalary,
    score: randomScore(), // demo score
    createdAt: new Date().toISOString(),
  };

  entries.unshift(entry);
  res.json({ ok: true, mode: "DEMO", entry });
});

// My Entries
app.get("/api/my-entries", (req, res) => {
  res.json({ mode: "DEMO", entries });
});

// Leaderboard
app.get("/api/leaderboard", (req, res) => {
  const poolId = req.query.poolId;
  const rows = entries
    .filter((e) => !poolId || e.poolId === poolId)
    .slice(0, 50)
    .map((e, idx) => ({ id: e.id, rank: idx + 1, score: e.score }));

  res.json({ mode: "DEMO", poolId: poolId || null, leaderboard: rows });
});

// ---- Serve Frontend (Vite build) ----
const distPath = path.join(__dirname, "frontend", "dist");

// Serve static assets
app.use(express.static(distPath));

// IMPORTANT: SPA fallback (but keep /api routes above!)
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SH Fantasy server running on port ${PORT}`);
});
