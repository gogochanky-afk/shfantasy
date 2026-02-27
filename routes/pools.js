// routes/pools.js
// GET /api/pools — returns today + tomorrow pools
// DATA_MODE=DEMO (default): deterministic demo pools
// DATA_MODE=LIVE: fetches real games from Sportradar, falls back to demo on error

const express = require("express");
const router = express.Router();

// ---- Demo data ----
const DEMO_POOLS = [
  {
    id: "demo-today",
    title: "Demo Pool · Today",
    homeTeam: { abbr: "LAL", name: "Los Angeles Lakers" },
    awayTeam: { abbr: "GSW", name: "Golden State Warriors" },
    rosterSize: 5,
    salaryCap: 10,
    lockAt: null,
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
    lockAt: null,
    status: "open",
    day: "tomorrow",
  },
];

/**
 * Deterministic 60-second lock cycle
 */
function getDeterministicLockAt() {
  return new Date(Math.floor(Date.now() / 60000) * 60000 + 60000).toISOString();
}

/**
 * Get today + tomorrow in Asia/Tokyo timezone (UTC+9)
 */
function getTodayTomorrow() {
  const now = new Date();
  const tokyoMs = now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000;
  const tokyoNow = new Date(tokyoMs);
  const fmt = (d) => d.toISOString().split("T")[0];
  const tomorrow = new Date(tokyoNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today: fmt(tokyoNow), tomorrow: fmt(tomorrow) };
}

/**
 * Convert a Sportradar game object into our pool schema
 */
function gameToPool(game, day) {
  const lockAt = game.scheduled
    ? new Date(new Date(game.scheduled).getTime() - 5 * 60000).toISOString()
    : getDeterministicLockAt();

  return {
    id: "sr-" + game.sr_game_id,
    title: (game.away_team.alias || game.away_team.name) + " @ " + (game.home_team.alias || game.home_team.name),
    homeTeam: { abbr: game.home_team.alias, name: game.home_team.name },
    awayTeam: { abbr: game.away_team.alias, name: game.away_team.name },
    srGameId: game.sr_game_id,
    rosterSize: 5,
    salaryCap: 10,
    lockAt,
    status: game.status === "closed" ? "closed" : "open",
    day,
  };
}

// ---- Route ----
router.get("/", async (req, res) => {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const updatedAt = new Date().toISOString();
  const lockAt = getDeterministicLockAt();

  // Always inject dynamic lockAt into demo pools
  const demoPools = DEMO_POOLS.map(function(p) { return Object.assign({}, p, { lockAt: lockAt }); });

  if (DATA_MODE !== "LIVE") {
    return res.json({
      ok: true,
      dataMode: "DEMO",
      updatedAt: updatedAt,
      pools: demoPools,
    });
  }

  // ---- LIVE mode: fetch from Sportradar ----
  try {
    const { fetchGames } = require("../lib/sportradar");
    const { today, tomorrow } = getTodayTomorrow();

    const todayGames = await fetchGames(today).catch(function() { return []; });
    const tomorrowGames = await fetchGames(tomorrow).catch(function() { return []; });

    const livePools = todayGames.map(function(g) { return gameToPool(g, "today"); })
      .concat(tomorrowGames.map(function(g) { return gameToPool(g, "tomorrow"); }));

    if (livePools.length === 0) {
      console.warn("[pools] LIVE mode: no games from Sportradar, falling back to DEMO");
      return res.json({
        ok: true,
        dataMode: "DEMO_FALLBACK",
        updatedAt: updatedAt,
        pools: demoPools,
      });
    }

    return res.json({
      ok: true,
      dataMode: "LIVE",
      updatedAt: updatedAt,
      pools: livePools,
    });
  } catch (err) {
    console.error("[pools] LIVE fetch error, falling back to DEMO:", err.message);
    return res.json({
      ok: true,
      dataMode: "DEMO_FALLBACK",
      updatedAt: updatedAt,
      pools: demoPools,
    });
  }
});

module.exports = router;
