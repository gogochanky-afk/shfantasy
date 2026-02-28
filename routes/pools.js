// routes/pools.js
// GET /api/pools — returns today + tomorrow pools
//
// DATA_MODE=DEMO (default): deterministic demo pools, no Sportradar call
// DATA_MODE=LIVE:
//   1. Return in-memory cache if < 120 s old (prevents repeated API calls)
//   2. On cache miss, call Sportradar
//   3. On 429: enter cooldown, serve SNAPSHOT if exists, else DEMO_FALLBACK
//   4. On other error: serve SNAPSHOT if exists, else DEMO_FALLBACK
//   5. On success: save DB snapshot (last-good)

"use strict";

const express = require("express");
const router  = express.Router();
const { getOrFetch } = require("../lib/cache");
const { saveSnapshot, loadLatestSnapshot } = require("../lib/poolsSnapshot");

const CACHE_TTL_S = 120; // seconds
const CACHE_KEY   = "pools:live";

// ---- Rate-limit cooldown (STOP hammering Sportradar) ----
let rateLimitUntilMs = 0;                 // epoch ms
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

function inCooldown() {
  return Date.now() < rateLimitUntilMs;
}
function enterCooldown() {
  rateLimitUntilMs = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

// ---- Demo data ----
const DEMO_POOLS_BASE = [
  {
    id: "demo-today",
    title: "Demo Pool · Today",
    homeTeam: { abbr: "LAL", name: "Los Angeles Lakers" },
    awayTeam: { abbr: "GSW", name: "Golden State Warriors" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "today",
  },
  {
    id: "demo-tomorrow",
    title: "Demo Pool · Tomorrow",
    homeTeam: { abbr: "BOS", name: "Boston Celtics" },
    awayTeam: { abbr: "MIA", name: "Miami Heat" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "tomorrow",
  },
];

function getDeterministicLockAt() {
  return new Date(Math.floor(Date.now() / 60000) * 60000 + 60000).toISOString();
}

function getDemoPools() {
  const lockAt = getDeterministicLockAt();
  return DEMO_POOLS_BASE.map(function(p) { return Object.assign({}, p, { lockAt: lockAt }); });
}

function getTodayTomorrow() {
  const now = new Date();
  const tokyoOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const tokyoTime   = new Date(now.getTime() + (tokyoOffset + localOffset) * 60000);
  const fmt = function(d) { return d.toISOString().split("T")[0]; };
  const tomorrow = new Date(tokyoTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today: fmt(tokyoTime), tomorrow: fmt(tomorrow) };
}

function gameToPool(game, day) {
  const lockAt = game.scheduled
    ? new Date(new Date(game.scheduled).getTime() - 5 * 60000).toISOString()
    : getDeterministicLockAt();
  return {
    id:       "sr-" + game.sr_game_id,
    title:    (game.away_team.alias || game.away_team.name) + " @ " + (game.home_team.alias || game.home_team.name),
    homeTeam: { abbr: game.home_team.alias, name: game.home_team.name },
    awayTeam: { abbr: game.away_team.alias, name: game.away_team.name },
    srGameId: game.sr_game_id,
    rosterSize: 5,
    salaryCap:  10,
    lockAt,
    status: game.status === "closed" ? "closed" : "open",
    day,
  };
}

function respondSnapshotOrDemo(res, nowIso, note) {
  const snap = loadLatestSnapshot();
  if (snap && Array.isArray(snap.pools) && snap.pools.length > 0) {
    return res.json({
      ok: true,
      dataMode: "SNAPSHOT",
      updatedAt: snap.createdAt || nowIso,
      pools: snap.pools,
      note: note || "serving DB snapshot",
    });
  }
  return res.json({
    ok: true,
    dataMode: "DEMO_FALLBACK",
    updatedAt: nowIso,
    pools: getDemoPools(),
    note: note || "no snapshot available; demo fallback",
  });
}

// ---- Route ----
router.get("/", async function(req, res) {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const nowIso = new Date().toISOString();

  // ---- DEMO mode — no Sportradar call at all ----
  if (DATA_MODE !== "LIVE") {
    return res.json({
      ok:        true,
      dataMode:  "DEMO",
      updatedAt: nowIso,
      pools:     getDemoPools(),
    });
  }

  // ---- LIVE mode ----
  // If we are in cooldown, DO NOT call Sportradar.
  if (inCooldown()) {
    return respondSnapshotOrDemo(res, nowIso, "rate-limit cooldown (skipping Sportradar)");
  }

  const { fetchGames } = require("../lib/sportradar");

  let cacheResult;
  try {
    cacheResult = await getOrFetch(CACHE_KEY, CACHE_TTL_S, async function() {
      const { today, tomorrow } = getTodayTomorrow();
      const todayGames    = await fetchGames(today);
      const tomorrowGames = await fetchGames(tomorrow);

      const pools = todayGames.map(function(g) { return gameToPool(g, "today"); })
        .concat(tomorrowGames.map(function(g) { return gameToPool(g, "tomorrow"); }));

      if (pools.length === 0) throw new Error("no games returned from Sportradar");

      // Save last-good snapshot to DB
      try {
        saveSnapshot("sportradar", pools);
      } catch (e) {
        console.warn("[pools] snapshot save failed:", e && e.message ? e.message : e);
      }

      return pools;
    });
  } catch (err) {
    const isRateLimit = err && err.isRateLimit;

    if (isRateLimit) {
      console.warn("[pools] 429 rate-limit → enter cooldown 15m");
      enterCooldown();
      return respondSnapshotOrDemo(res, nowIso, "429 rate-limit; served snapshot if available");
    }

    console.error("[pools] fetch error (non-429):", err && err.message ? err.message : err);
    return respondSnapshotOrDemo(res, nowIso, "fetch error; served snapshot if available");
  }

  const dataMode = cacheResult.stale ? "LIVE_STALE" : "LIVE";
  if (cacheResult.stale) {
    console.warn("[pools] serving LIVE_STALE cache (age=" +
      Math.round((Date.now() - new Date(cacheResult.cachedAt).getTime()) / 1000) + "s)");
  }

  return res.json({
    ok:        true,
    dataMode:  dataMode,
    updatedAt: cacheResult.cachedAt,
    pools:     cacheResult.value,
  });
});

module.exports = router;
