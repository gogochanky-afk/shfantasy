// routes/players.js
// GET /api/players?poolId=<id>
//
// DATA_MODE=DEMO (default): return demo players filtered by pool teams
// DATA_MODE=LIVE:
//   1. Try roster_snapshots DB (SNAPSHOT)
//   2. If no DB snapshot, try Sportradar roster API (cached 120 s)
//   3. On 429: serve stale cache with dataMode="LIVE_STALE"
//   4. On any failure: fall back to demo players with dataMode="DEMO_FALLBACK"

"use strict";

const express = require("express");
const router  = express.Router();
const { getOrFetch } = require("../lib/cache");

const CACHE_TTL_S = 120; // seconds

// ---- Demo players ----
const DEMO_PLAYERS = [
  { id: "p1",  name: "LeBron James",         team: "LAL", position: "SF", cost: 4 },
  { id: "p2",  name: "Stephen Curry",         team: "GSW", position: "PG", cost: 4 },
  { id: "p3",  name: "Giannis Antetokounmpo", team: "MIL", position: "PF", cost: 4 },
  { id: "p4",  name: "Luka Doncic",           team: "DAL", position: "PG", cost: 4 },
  { id: "p5",  name: "Nikola Jokic",          team: "DEN", position: "C",  cost: 4 },
  { id: "p6",  name: "Jayson Tatum",          team: "BOS", position: "SF", cost: 3 },
  { id: "p7",  name: "Kevin Durant",          team: "PHX", position: "SF", cost: 3 },
  { id: "p8",  name: "Joel Embiid",           team: "PHI", position: "C",  cost: 3 },
  { id: "p9",  name: "Damian Lillard",        team: "MIL", position: "PG", cost: 3 },
  { id: "p10", name: "Anthony Davis",         team: "LAL", position: "PF", cost: 3 },
  { id: "p11", name: "Devin Booker",          team: "PHX", position: "SG", cost: 2 },
  { id: "p12", name: "Ja Morant",             team: "MEM", position: "PG", cost: 2 },
  { id: "p13", name: "Trae Young",            team: "ATL", position: "PG", cost: 2 },
  { id: "p14", name: "Zion Williamson",       team: "NOP", position: "PF", cost: 2 },
  { id: "p15", name: "Bam Adebayo",           team: "MIA", position: "C",  cost: 2 },
  { id: "p16", name: "De'Aaron Fox",          team: "SAC", position: "PG", cost: 1 },
  { id: "p17", name: "Tyrese Haliburton",     team: "IND", position: "PG", cost: 1 },
  { id: "p18", name: "Paolo Banchero",        team: "ORL", position: "PF", cost: 1 },
  { id: "p19", name: "Franz Wagner",          team: "ORL", position: "SF", cost: 1 },
  { id: "p20", name: "Cade Cunningham",       team: "DET", position: "PG", cost: 1 },
];

// Pool → teams for demo filtering
const DEMO_POOL_TEAMS = {
  "demo-today":    { home: "LAL", away: "GSW" },
  "demo-tomorrow": { home: "BOS", away: "MIA" },
};

function getDemoPlayers(poolId) {
  const teams = DEMO_POOL_TEAMS[poolId];
  if (!teams) return DEMO_PLAYERS;
  const filtered = DEMO_PLAYERS.filter(function(p) {
    return p.team === teams.home || p.team === teams.away;
  });
  if (filtered.length < 10) {
    const extra = DEMO_PLAYERS.filter(function(p) {
      return p.team !== teams.home && p.team !== teams.away;
    }).slice(0, 10 - filtered.length);
    return filtered.concat(extra);
  }
  return filtered;
}

function parseRosterSnapshot(row) {
  try {
    const data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json;
    const players = data.players || [];
    return players.map(function(p, i) {
      return {
        id:           p.id || ("live-" + i),
        name:         p.name || p.full_name || "Unknown",
        team:         p.team || p.team_abbr || "N/A",
        position:     p.position || p.primary_position || "?",
        cost:         p.price || p.cost || 1,
        injuryStatus: p.injury_status || p.status || null,
      };
    });
  } catch (e) {
    console.error("[players] Failed to parse roster snapshot:", e.message);
    return null;
  }
}

// ---- Route ----
router.get("/", async function(req, res) {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const poolId    = String(req.query.poolId || "").trim();
  const now       = new Date().toISOString();

  // ---- DEMO mode ----
  if (DATA_MODE !== "LIVE") {
    return res.json({
      ok:        true,
      dataMode:  "DEMO",
      poolId:    poolId || null,
      updatedAt: now,
      players:   getDemoPlayers(poolId),
    });
  }

  // ---- LIVE mode ----

  // 1. Try roster_snapshots DB first (no API call, no rate-limit risk)
  if (poolId) {
    try {
      const { getLatestRoster } = require("../lib/db");
      const row = getLatestRoster(poolId);
      if (row) {
        const players = parseRosterSnapshot(row);
        if (players && players.length > 0) {
          return res.json({
            ok:        true,
            dataMode:  "SNAPSHOT",
            poolId:    poolId,
            updatedAt: row.captured_at || now,
            players:   players,
          });
        }
      }
      console.warn("[players] no DB snapshot for poolId=" + poolId);
    } catch (dbErr) {
      console.error("[players] DB error:", dbErr.message);
    }
  }

  // 2. Try Sportradar roster API with 120 s cache
  //    (Only if poolId looks like a Sportradar game id, i.e. starts with "sr-")
  if (poolId && poolId.startsWith("sr-")) {
    const srGameId  = poolId.replace(/^sr-/, "");
    const cacheKey  = "players:" + poolId;

    let cacheResult;
    try {
      cacheResult = await getOrFetch(cacheKey, CACHE_TTL_S, async function() {
        // Sportradar roster endpoint (trial/production)
        const axios = require("axios");
        const SPORTRADAR_API_KEY  = process.env.SPORTRADAR_API_KEY  || "";
        const SPORTRADAR_BASE_URL = process.env.SPORTRADAR_BASE_URL || "https://api.sportradar.com";
        const NBA_ACCESS_LEVEL    = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";

        if (!SPORTRADAR_API_KEY) throw new Error("SPORTRADAR_API_KEY not set");

        const url = SPORTRADAR_BASE_URL +
          "/nba/" + NBA_ACCESS_LEVEL +
          "/v8/en/games/" + srGameId + "/boxscore.json";

        const resp = await axios.get(url, {
          params: { api_key: SPORTRADAR_API_KEY },
          timeout: 10000,
          validateStatus: function() { return true; },
        });

        if (resp.status === 429) {
          const { RateLimitError } = require("../lib/sportradar");
          throw new RateLimitError("429 on players for " + poolId);
        }
        if (resp.status !== 200) {
          throw new Error("HTTP " + resp.status + " for game " + srGameId);
        }

        // Parse home + away rosters from boxscore
        const data = resp.data || {};
        const homePlayers = ((data.home && data.home.players) || []).map(function(p, i) {
          return {
            id:           "h-" + (p.id || i),
            name:         (p.full_name || p.name || "Unknown"),
            team:         (data.home && data.home.alias) || "HOME",
            position:     p.primary_position || p.position || "?",
            cost:         computeCost(p),
            injuryStatus: p.status !== "A" ? p.status : null,
          };
        });
        const awayPlayers = ((data.away && data.away.players) || []).map(function(p, i) {
          return {
            id:           "a-" + (p.id || i),
            name:         (p.full_name || p.name || "Unknown"),
            team:         (data.away && data.away.alias) || "AWAY",
            position:     p.primary_position || p.position || "?",
            cost:         computeCost(p),
            injuryStatus: p.status !== "A" ? p.status : null,
          };
        });

        const all = homePlayers.concat(awayPlayers);
        if (all.length === 0) throw new Error("no players in boxscore for " + srGameId);
        return all;
      });
    } catch (err) {
      // No stale cache available — fall through to DEMO fallback below
      console.error("[players] Sportradar fetch failed, no cache: " + err.message);
      cacheResult = null;
    }

    if (cacheResult) {
      const dataMode = cacheResult.stale ? "LIVE_STALE" : "LIVE";
      return res.json({
        ok:        true,
        dataMode:  dataMode,
        poolId:    poolId,
        updatedAt: cacheResult.cachedAt,
        players:   cacheResult.value,
      });
    }
  }

  // 3. DEMO fallback
  console.warn("[players] falling back to DEMO for poolId=" + poolId);
  return res.json({
    ok:        true,
    dataMode:  "DEMO_FALLBACK",
    poolId:    poolId || null,
    updatedAt: now,
    players:   getDemoPlayers(poolId),
  });
});

/**
 * Simple cost assignment based on points average (if available) or position.
 */
function computeCost(p) {
  if (p.average && p.average.points) {
    const pts = Number(p.average.points);
    if (pts >= 25) return 4;
    if (pts >= 18) return 3;
    if (pts >= 10) return 2;
    return 1;
  }
  // Position-based fallback
  const pos = (p.primary_position || p.position || "").toUpperCase();
  if (pos === "PG" || pos === "SF" || pos === "PF") return 2;
  return 1;
}

module.exports = router;
