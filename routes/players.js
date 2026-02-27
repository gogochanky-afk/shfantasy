// routes/players.js
// GET /api/players?poolId=xxx
// DATA_MODE=DEMO (default): returns demo players filtered by pool teams
// DATA_MODE=LIVE: fetches real roster from roster_snapshots DB, falls back to demo

const express = require("express");
const router = express.Router();

// ---- Demo players (20 players, varying costs) ----
const DEMO_PLAYERS = [
  { id: "p1",  name: "LeBron James",             team: "LAL", position: "SF", cost: 4 },
  { id: "p2",  name: "Stephen Curry",             team: "GSW", position: "PG", cost: 4 },
  { id: "p3",  name: "Giannis Antetokounmpo",     team: "MIL", position: "PF", cost: 4 },
  { id: "p4",  name: "Luka Doncic",               team: "DAL", position: "PG", cost: 4 },
  { id: "p5",  name: "Nikola Jokic",              team: "DEN", position: "C",  cost: 4 },
  { id: "p6",  name: "Jayson Tatum",              team: "BOS", position: "SF", cost: 3 },
  { id: "p7",  name: "Kevin Durant",              team: "PHX", position: "SF", cost: 3 },
  { id: "p8",  name: "Joel Embiid",               team: "PHI", position: "C",  cost: 3 },
  { id: "p9",  name: "Damian Lillard",            team: "MIL", position: "PG", cost: 3 },
  { id: "p10", name: "Anthony Davis",             team: "LAL", position: "PF", cost: 3 },
  { id: "p11", name: "Devin Booker",              team: "PHX", position: "SG", cost: 2 },
  { id: "p12", name: "Ja Morant",                 team: "MEM", position: "PG", cost: 2 },
  { id: "p13", name: "Trae Young",                team: "ATL", position: "PG", cost: 2 },
  { id: "p14", name: "Zion Williamson",           team: "NOP", position: "PF", cost: 2 },
  { id: "p15", name: "Bam Adebayo",               team: "MIA", position: "C",  cost: 2 },
  { id: "p16", name: "De'Aaron Fox",              team: "SAC", position: "PG", cost: 1 },
  { id: "p17", name: "Tyrese Haliburton",         team: "IND", position: "PG", cost: 1 },
  { id: "p18", name: "Paolo Banchero",            team: "ORL", position: "PF", cost: 1 },
  { id: "p19", name: "Franz Wagner",              team: "ORL", position: "SF", cost: 1 },
  { id: "p20", name: "Cade Cunningham",           team: "DET", position: "PG", cost: 1 },
];

// Pool → teams mapping for demo mode
const DEMO_POOL_TEAMS = {
  "demo-today":    { home: "LAL", away: "GSW" },
  "demo-tomorrow": { home: "BOS", away: "MIA" },
};

/**
 * Filter demo players by pool teams; if no match, return all 20
 */
function getDemoPlayers(poolId) {
  const teams = DEMO_POOL_TEAMS[poolId];
  if (!teams) return DEMO_PLAYERS;
  const filtered = DEMO_PLAYERS.filter(
    function(p) { return p.team === teams.home || p.team === teams.away; }
  );
  // Pad to at least 10 players
  if (filtered.length < 10) {
    const extra = DEMO_PLAYERS.filter(
      function(p) { return p.team !== teams.home && p.team !== teams.away; }
    ).slice(0, 10 - filtered.length);
    return filtered.concat(extra);
  }
  return filtered;
}

/**
 * Convert a raw roster_snapshot row into player objects
 * Expects data_json to contain { players: [...] }
 */
function parseRosterSnapshot(row) {
  try {
    const data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
    const players = data.players || [];
    return players.map(function(p, i) {
      return {
        id: p.id || ("live-" + i),
        name: p.name || p.full_name || "Unknown",
        team: p.team || p.team_abbr || "N/A",
        position: p.position || p.primary_position || "?",
        cost: p.price || p.cost || 1,
        injuryStatus: p.injury_status || p.status || null,
      };
    });
  } catch (e) {
    console.error("[players] Failed to parse roster snapshot:", e.message);
    return null;
  }
}

// ---- Route ----
router.get("/", async (req, res) => {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const poolId = String(req.query.poolId || "").trim();
  const updatedAt = new Date().toISOString();

  // ---- DEMO mode ----
  if (DATA_MODE !== "LIVE") {
    const players = getDemoPlayers(poolId);
    return res.json({
      ok: true,
      dataMode: "DEMO",
      poolId: poolId || null,
      updatedAt: updatedAt,
      players: players,
    });
  }

  // ---- LIVE mode ----
  // Try to read from roster_snapshots in SQLite DB
  if (poolId) {
    try {
      const { getLatestRoster } = require("../lib/db");
      const row = getLatestRoster(poolId);
      if (row) {
        const players = parseRosterSnapshot(row);
        if (players && players.length > 0) {
          return res.json({
            ok: true,
            dataMode: "LIVE",
            poolId: poolId,
            updatedAt: row.captured_at || updatedAt,
            players: players,
          });
        }
      }
      console.warn("[players] LIVE: no roster snapshot for poolId=" + poolId + ", falling back to DEMO");
    } catch (err) {
      console.error("[players] LIVE DB error:", err.message);
    }
  }

  // Fallback to demo players
  const players = getDemoPlayers(poolId);
  return res.json({
    ok: true,
    dataMode: "DEMO_FALLBACK",
    poolId: poolId || null,
    updatedAt: updatedAt,
    players: players,
  });
});

module.exports = router;
