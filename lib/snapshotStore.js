"use strict";
/**
 * lib/snapshotStore.js
 * Reads snapshot data from /data/*.json once on startup and caches in memory.
 * Zero network calls. Zero DB. Zero Sportradar.
 */

const path = require("path");
const fs   = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");

// ── Load once at module init ──────────────────────────────────────────────────
let _pools   = null;
let _players = null;

function loadPools() {
  if (_pools) return _pools;
  try {
    var raw = fs.readFileSync(path.join(DATA_DIR, "snapshot_pools.json"), "utf8");
    var parsed = JSON.parse(raw);
    // Compute lockAt dynamically: today's pool locks in 4h, tomorrow's in 28h
    var now = Date.now();
    parsed.pools.forEach(function (p, i) {
      if (!p.lockAt) {
        p.lockAt = new Date(now + (i === 0 ? 4 : 28) * 60 * 60 * 1000).toISOString();
      }
    });
    _pools = parsed;
  } catch (e) {
    console.error("[snapshotStore] Failed to load snapshot_pools.json:", e.message);
    // Hardcoded fallback so service never crashes
    var now2 = Date.now();
    _pools = {
      dataMode: "SNAPSHOT",
      pools: [
        {
          id: "pool-lal-gsw-today",
          label: "Lakers vs Warriors",
          title: "Lakers vs Warriors",
          homeTeam: "LAL", awayTeam: "GSW",
          status: "open", rosterSize: 5, salaryCap: 10, day: "today",
          lockAt: new Date(now2 + 4 * 3600000).toISOString()
        },
        {
          id: "pool-bos-mia-tmrw",
          label: "Celtics vs Heat",
          title: "Celtics vs Heat",
          homeTeam: "BOS", awayTeam: "MIA",
          status: "open", rosterSize: 5, salaryCap: 10, day: "tomorrow",
          lockAt: new Date(now2 + 28 * 3600000).toISOString()
        }
      ]
    };
  }
  return _pools;
}

function loadPlayers() {
  if (_players) return _players;
  try {
    var raw = fs.readFileSync(path.join(DATA_DIR, "snapshot_players.json"), "utf8");
    _players = JSON.parse(raw);
  } catch (e) {
    console.error("[snapshotStore] Failed to load snapshot_players.json:", e.message);
    _players = {};
  }
  return _players;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getPools() -> { dataMode, pools }
 */
function getPools() {
  return loadPools();
}

/**
 * getPlayers(poolId) -> { dataMode, poolId, players }
 */
function getPlayers(poolId) {
  var all = loadPlayers();
  var players = all[poolId] || null;

  if (!players) {
    // Fallback: return all players across all pools
    var fallback = [];
    Object.keys(all).forEach(function (k) {
      fallback = fallback.concat(all[k]);
    });
    players = fallback.length > 0 ? fallback : _hardcodedFallback();
  }

  return {
    dataMode: "SNAPSHOT",
    poolId: poolId || "fallback",
    updatedAt: new Date().toISOString(),
    players: players
  };
}

function _hardcodedFallback() {
  return [
    { id:"fb-1",  name:"LeBron James",   team:"LAL", position:"SF", cost:3, injuryStatus:null },
    { id:"fb-2",  name:"Stephen Curry",  team:"GSW", position:"PG", cost:3, injuryStatus:null },
    { id:"fb-3",  name:"Jayson Tatum",   team:"BOS", position:"SF", cost:3, injuryStatus:null },
    { id:"fb-4",  name:"Jimmy Butler",   team:"MIA", position:"SF", cost:3, injuryStatus:null },
    { id:"fb-5",  name:"Anthony Davis",  team:"LAL", position:"C",  cost:2, injuryStatus:null },
    { id:"fb-6",  name:"Draymond Green", team:"GSW", position:"PF", cost:2, injuryStatus:null },
    { id:"fb-7",  name:"Jaylen Brown",   team:"BOS", position:"SG", cost:2, injuryStatus:null },
    { id:"fb-8",  name:"Bam Adebayo",    team:"MIA", position:"C",  cost:2, injuryStatus:null },
    { id:"fb-9",  name:"Austin Reaves",  team:"LAL", position:"SG", cost:1, injuryStatus:null },
    { id:"fb-10", name:"Klay Thompson",  team:"GSW", position:"SG", cost:1, injuryStatus:null },
    { id:"fb-11", name:"Jrue Holiday",   team:"BOS", position:"PG", cost:1, injuryStatus:null },
    { id:"fb-12", name:"Tyler Herro",    team:"MIA", position:"SG", cost:1, injuryStatus:null }
  ];
}

module.exports = { getPools, getPlayers };
