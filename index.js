const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Cloud Run uses PORT env
const PORT = process.env.PORT || 8080;

// DATA_MODE: "demo" | "live"
const DATA_MODE = process.env.DATA_MODE || "demo";

// In-memory storage for demo entries
const entries = [];
let entryIdCounter = 1;

// Demo players data
const DEMO_PLAYERS = [
  { id: "p1", name: "LeBron James", team: "LAL", position: "SF", cost: 4 },
  { id: "p2", name: "Stephen Curry", team: "GSW", position: "PG", cost: 4 },
  { id: "p3", name: "Giannis Antetokounmpo", team: "MIL", position: "PF", cost: 4 },
  { id: "p4", name: "Luka Doncic", team: "DAL", position: "PG", cost: 4 },
  { id: "p5", name: "Nikola Jokic", team: "DEN", position: "C", cost: 4 },
  { id: "p6", name: "Jayson Tatum", team: "BOS", position: "SF", cost: 3 },
  { id: "p7", name: "Kevin Durant", team: "PHX", position: "SF", cost: 3 },
  { id: "p8", name: "Joel Embiid", team: "PHI", position: "C", cost: 3 },
  { id: "p9", name: "Damian Lillard", team: "MIL", position: "PG", cost: 3 },
  { id: "p10", name: "Anthony Davis", team: "LAL", position: "PF", cost: 3 },
  { id: "p11", name: "Devin Booker", team: "PHX", position: "SG", cost: 2 },
  { id: "p12", name: "Ja Morant", team: "MEM", position: "PG", cost: 2 },
  { id: "p13", name: "Trae Young", team: "ATL", position: "PG", cost: 2 },
  { id: "p14", name: "Zion Williamson", team: "NOP", position: "PF", cost: 2 },
  { id: "p15", name: "Bam Adebayo", team: "MIA", position: "C", cost: 2 },
  { id: "p16", name: "De'Aaron Fox", team: "SAC", position: "PG", cost: 1 },
  { id: "p17", name: "Tyrese Haliburton", team: "IND", position: "PG", cost: 1 },
  { id: "p18", name: "Paolo Banchero", team: "ORL", position: "PF", cost: 1 },
  { id: "p19", name: "Franz Wagner", team: "ORL", position: "SF", cost: 1 },
  { id: "p20", name: "Cade Cunningham", team: "DET", position: "PG", cost: 1 },
];

/**
 * API health check (used by frontend + monitoring)
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy",
    data_mode: DATA_MODE,
    ts: new Date().toISOString(),
  });
});

/**
 * API: Get available pools with players
 */
app.get("/api/pools", (req, res) => {
  res.json({
    ok: true,
    pools: [
      {
        id: "demo-pool-1",
        name: "NBA Daily Blitz",
        entry_fee: 5,
        prize_pool: 100,
        entries: entries.length,
        max_entries: 50,
        salary_cap: 10,
        required_players: 5,
        start_time: new Date().toISOString(),
        players: DEMO_PLAYERS,
      },
    ],
    data_mode: DATA_MODE,
  });
});

/**
 * API: Get user entries
 */
app.get("/api/entries", (req, res) => {
  res.json({
    ok: true,
    entries: entries.map((entry) => ({
      ...entry,
      players: entry.player_ids.map((pid) =>
        DEMO_PLAYERS.find((p) => p.id === pid)
      ),
      total_cost: entry.player_ids.reduce((sum, pid) => {
        const player = DEMO_PLAYERS.find((p) => p.id === pid);
        return sum + (player ? player.cost : 0);
      }, 0),
    })),
    data_mode: DATA_MODE,
  });
});

/**
 * API: Submit new entry
 */
app.post("/api/entries", (req, res) => {
  const { pool_id, player_ids } = req.body;

  // Validation: pool exists
  if (pool_id !== "demo-pool-1") {
    return res.status(400).json({
      ok: false,
      error: "Pool not found",
    });
  }

  // Validation: exactly 5 players
  if (!player_ids || player_ids.length !== 5) {
    return res.status(400).json({
      ok: false,
      error: "Must select exactly 5 players",
    });
  }

  // Validation: all players exist
  const players = player_ids.map((pid) => DEMO_PLAYERS.find((p) => p.id === pid));
  if (players.some((p) => !p)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid player ID",
    });
  }

  // Validation: total cost <= 10
  const totalCost = players.reduce((sum, p) => sum + p.cost, 0);
  if (totalCost > 10) {
    return res.status(400).json({
      ok: false,
      error: `Total cost ${totalCost} exceeds salary cap of 10`,
    });
  }

  // Create entry
  const entry = {
    id: `entry-${entryIdCounter++}`,
    pool_id,
    pool_name: "NBA Daily Blitz",
    player_ids,
    status: "active",
    score: 0,
    rank: null,
    created_at: new Date().toISOString(),
  };

  entries.push(entry);

  res.json({
    ok: true,
    entry_id: entry.id,
    entry,
  });
});

/**
 * Serve React frontend (static files from frontend/dist)
 */
const frontendPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendPath));

/**
 * SPA fallback: serve index.html for all non-API routes
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SHFantasy listening on ${PORT}`);
  console.log(`DATA_MODE=${DATA_MODE}`);
});
