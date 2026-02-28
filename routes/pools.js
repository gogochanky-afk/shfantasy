// routes/pools.js
// GET /api/pools — returns today + tomorrow pools
//
// DATA_MODE=DEMO (default): deterministic demo pools, no Sportradar call
// DATA_MODE=LIVE:
//   1. Return in-memory cache if < 120 s old (prevents repeated API calls)
//   2. On cache miss, call Sportradar
//   3. On 429 (rate-limit): serve stale cache (any age) with dataMode="LIVE_STALE"
//   4. On other error / empty result: fall back to DEMO pools with dataMode="DEMO_FALLBACK"

"use strict";

const express = require("express");
const router  = express.Router();
const { getOrFetch } = require("../lib/cache");

const CACHE_TTL_S = 120; // seconds
const CACHE_KEY   = "pools:live";

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

// ---- Route ----
router.get("/", async function(req, res) {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const now = new Date().toISOString();

  // ---- DEMO mode — no Sportradar call at all ----
  if (DATA_MODE !== "LIVE") {
    return res.json({
      ok:        true,
      dataMode:  "DEMO",
      updatedAt: now,
      pools:     getDemoPools(),
    });
  }

  // ---- LIVE mode ----
  const { fetchGames, RateLimitError } = require("../lib/sportradar");
  const { peek } = require("../lib/cache");

  let cacheResult;
  try {
    cacheResult = await getOrFetch(CACHE_KEY, CACHE_TTL_S, async function() {
      // This fetcher is only called when cache is cold/expired
      const { today, tomorrow } = getTodayTomorrow();
      const todayGames    = await fetchGames(today);
      const tomorrowGames = await fetchGames(tomorrow);
      const pools = todayGames.map(function(g) { return gameToPool(g, "today"); })
        .concat(tomorrowGames.map(function(g) { return gameToPool(g, "tomorrow"); }));
      if (pools.length === 0) {
        // Treat empty result as a soft failure — caller will use DEMO fallback
        throw new Error("no games returned from Sportradar");
      }
      return pools;
    });
  } catch (err) {
    // getOrFetch only re-throws when there is NO stale entry at all
    const isRateLimit = err && err.isRateLimit;
    console.error(
      "[pools] " + (isRateLimit ? "429 rate-limit" : "fetch error") +
      " and no cache available — using DEMO fallback: " + err.message
    );
    return res.json({
      ok:        true,
      dataMode:  "DEMO_FALLBACK",
      updatedAt: now,
      pools:     getDemoPools(),
    });
  }

  // Determine dataMode label
  let dataMode;
  if (cacheResult.stale) {
    // Stale cache was served because the fresh fetch failed (e.g. 429)
    dataMode = "LIVE_STALE";
    console.warn("[pools] serving LIVE_STALE cache (age=" +
      Math.round((Date.now() - new Date(cacheResult.cachedAt).getTime()) / 1000) + "s)");
  } else {
    dataMode = "LIVE";
  }

  return res.json({
    ok:        true,
    dataMode:  dataMode,
    updatedAt: cacheResult.cachedAt,
    pools:     cacheResult.value,
  });
});

module.exports = router;
