// lib/sportradar.js
// Sportradar NBA API wrapper.
// Throws RateLimitError on HTTP 429 so callers can serve stale cache
// instead of falling back to DEMO data.

"use strict";

const axios = require("axios");

const SPORTRADAR_API_KEY  = process.env.SPORTRADAR_API_KEY  || "";
const SPORTRADAR_BASE_URL = process.env.SPORTRADAR_BASE_URL || "https://api.sportradar.com";
const NBA_ACCESS_LEVEL    = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";

// ---- Typed error for HTTP 429 ----
class RateLimitError extends Error {
  constructor(msg) {
    super(msg || "Sportradar rate limit (429)");
    this.name = "RateLimitError";
    this.isRateLimit = true;
  }
}

/**
 * Fetch NBA games for a specific date (YYYY-MM-DD).
 * Throws RateLimitError on 429; throws generic Error on other failures.
 * Returns [] when API key is missing.
 */
async function fetchGames(date) {
  if (!SPORTRADAR_API_KEY) {
    console.warn("[sportradar] SPORTRADAR_API_KEY not set — skipping API call");
    return [];
  }

  const [year, month, day] = date.split("-");
  const url =
    SPORTRADAR_BASE_URL +
    "/nba/" + NBA_ACCESS_LEVEL +
    "/v8/en/games/" + year + "/" + month + "/" + day + "/schedule.json";

  console.log("[sportradar] GET " + date);

  let response;
  try {
    response = await axios.get(url, {
      params:  { api_key: SPORTRADAR_API_KEY },
      timeout: 10000,
      validateStatus: function() { return true; }, // handle status ourselves
    });
  } catch (networkErr) {
    throw new Error("[sportradar] Network error for " + date + ": " + networkErr.message);
  }

  if (response.status === 429) {
    throw new RateLimitError("429 Too Many Requests for date=" + date);
  }

  if (response.status !== 200) {
    throw new Error("[sportradar] HTTP " + response.status + " for date=" + date);
  }

  const games = (response.data && response.data.games) || [];
  console.log("[sportradar] " + games.length + " game(s) for " + date);

  return games.map(function(game) {
    return {
      sr_game_id: game.id,
      scheduled:  game.scheduled,
      home_team: {
        id:    game.home && game.home.id,
        name:  game.home && game.home.name,
        alias: game.home && game.home.alias,
      },
      away_team: {
        id:    game.away && game.away.id,
        name:  game.away && game.away.name,
        alias: game.away && game.away.alias,
      },
      status: game.status,
    };
  });
}

/**
 * Get today and tomorrow dates in Asia/Tokyo timezone (UTC+9).
 */
function getTodayTomorrow() {
  const now = new Date();
  const tokyoOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const tokyoTime   = new Date(now.getTime() + (tokyoOffset + localOffset) * 60000);

  const today = tokyoTime.toISOString().split("T")[0];
  const tomorrowDate = new Date(tokyoTime);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split("T")[0];

  return { today, tomorrow };
}

/**
 * Fetch today + tomorrow games, max 6, sorted by schedule time.
 * Fetches sequentially (not parallel) to reduce rate-limit risk.
 * Propagates RateLimitError so callers can use stale cache.
 */
async function fetchTodayTomorrowGames() {
  const { today, tomorrow } = getTodayTomorrow();
  console.log("[sportradar] fetchTodayTomorrowGames: " + today + " + " + tomorrow);

  const todayGames    = await fetchGames(today);
  const tomorrowGames = await fetchGames(tomorrow);

  const allGames = todayGames.concat(tomorrowGames);
  allGames.sort(function(a, b) { return new Date(a.scheduled) - new Date(b.scheduled); });

  const limited = allGames.slice(0, 6);
  console.log("[sportradar] returning " + limited.length + " game(s) (max 6)");
  return limited;
}

module.exports = { fetchGames, fetchTodayTomorrowGames, getTodayTomorrow, RateLimitError };
