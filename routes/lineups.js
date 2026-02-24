// /routes/lineup.js
const express = require("express");
const router = express.Router();

// ---- Demo in-memory DB ----
const MEM = global.__SHF_MEM__ || (global.__SHF_MEM__ = { entries: new Map() });

// Demo pool config (同你 UI 預設一致：5人、cap=10)
function getPool(poolId) {
  const id = poolId || "demo-1";
  return {
    id,
    name: id,
    rosterSize: 5,
    salaryCap: 10,
    lockAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
    locked: false,
  };
}

// Same demo player list as /api/players (keep consistent for cap check)
function getPlayers() {
  return [
    { id: "p1", name: "LeBron James", team: "LAL", cost: 4 },
    { id: "p2", name: "Stephen Curry", team: "GSW", cost: 4 },
    { id: "p3", name: "Jayson Tatum", team: "BOS", cost: 3 },
    { id: "p4", name: "Shai Gilgeous-Alexander", team: "OKC", cost: 3 },
    { id: "p5", name: "Bam Adebayo", team: "MIA", cost: 2 },
    { id: "p6", name: "Mikal Bridges", team: "BKN", cost: 2 },
    { id: "p7", name: "Alex Caruso", team: "OKC", cost: 1 },
    { id: "p8", name: "Austin Reaves", team: "LAL", cost: 1 },
  ];
}

function calcCost(playerIds) {
  const all = getPlayers();
  const map = new Map(all.map((p) => [String(p.id), Number(p.cost) || 0]));
  let c = 0;
  for (const id of playerIds) c += map.get(String(id)) || 0;
  return c;
}

/**
 * GET /api/lineup?entryId=xxx
 * Returns: { ok:true, entry:{...}, pool:{...} }
 */
router.get("/", (req, res) => {
  const entryId = String(req.query.entryId || "").trim();
  if (!entryId) {
    return res.status(400).json({ ok: false, error: "entryId is required" });
  }

  // if not found, create demo entry so Draft can load
  let entry = MEM.entries.get(entryId);
  if (!entry) {
    entry = {
      id: entryId,
      poolId: "demo-1",
      players: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MEM.entries.set(entryId, entry);
  }

  const pool = getPool(entry.poolId);

  return res.status(200).json({
    ok: true,
    entry,
    pool,
  });
});

/**
 * POST /api/lineup
 * Body: { entryId, players: [...] }
 */
router.post("/", (req, res) => {
  try {
    const entryId = String(req.body.entryId || "").trim();
    const players = Array.isArray(req.body.players) ? req.body.players.map(String) : [];

    if (!entryId) {
      return res.status(400).json({ ok: false, error: "entryId is required" });
    }

    // ensure entry exists
    let entry = MEM.entries.get(entryId);
    if (!entry) {
      entry = {
        id: entryId,
        poolId: "demo-1",
        players: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MEM.entries.set(entryId, entry);
    }

    const pool = getPool(entry.poolId);

    // Basic validation
    if (pool.locked) {
      return res.status(403).json({ ok: false, error: "POOL_LOCKED" });
    }

    if (players.length !== pool.rosterSize) {
      return res.status(400).json({
        ok: false,
        error: `Must pick exactly ${pool.rosterSize} players`,
      });
    }

    const cost = calcCost(players);
    if (cost > pool.salaryCap) {
      return res.status(400).json({
        ok: false,
        error: `Over salary cap: ${cost}/${pool.salaryCap}`,
      });
    }

    // Save
    entry.players = players;
    entry.updatedAt = new Date().toISOString();
    MEM.entries.set(entryId, entry);

    return res.status(200).json({
      ok: true,
      entryId,
      poolId: entry.poolId,
      savedPlayers: players,
      cost,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "LINEUP_SAVE_FAILED" });
  }
});

module.exports = router;
