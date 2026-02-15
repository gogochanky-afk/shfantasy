const axios = require("axios");

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || "";
const SPORTRADAR_BASE_URL = process.env.SPORTRADAR_BASE_URL || "https://api.sportradar.com";
const NBA_ACCESS_LEVEL = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";

/**
 * Fetch NBA games for a specific date
 * @param {string} date - Format: YYYY-MM-DD
 * @returns {Promise<Array>} List of games
 */
async function fetchGames(date) {
  if (!SPORTRADAR_API_KEY) {
    console.warn("⚠️ SPORTRADAR_API_KEY not set, skipping API call");
    return [];
  }

  try {
    const [year, month, day] = date.split("-");
    const url = `${SPORTRADAR_BASE_URL}/nba/${NBA_ACCESS_LEVEL}/v8/en/games/${year}/${month}/${day}/schedule.json`;

    console.log(`[Sportradar] Fetching games for ${date}...`);

    const response = await axios.get(url, {
      params: { api_key: SPORTRADAR_API_KEY },
      timeout: 10000,
    });

    const games = response.data.games || [];
    console.log(`[Sportradar] Found ${games.length} games for ${date}`);

    return games.map((game) => ({
      sr_game_id: game.id,
      scheduled: game.scheduled,
      home_team: {
        id: game.home?.id,
        name: game.home?.name,
        alias: game.home?.alias,
      },
      away_team: {
        id: game.away?.id,
        name: game.away?.name,
        alias: game.away?.alias,
      },
      status: game.status,
    }));
  } catch (error) {
    console.error(`[Sportradar] Error fetching games for ${date}:`, error.message);
    return [];
  }
}

/**
 * Get today and tomorrow dates in Asia/Tokyo timezone
 * @returns {{today: string, tomorrow: string}}
 */
function getTodayTomorrow() {
  const now = new Date();
  const tokyoOffset = 9 * 60; // UTC+9
  const localOffset = now.getTimezoneOffset();
  const tokyoTime = new Date(now.getTime() + (tokyoOffset + localOffset) * 60000);

  const today = tokyoTime.toISOString().split("T")[0];

  const tomorrowDate = new Date(tokyoTime);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split("T")[0];

  return { today, tomorrow };
}

/**
 * Fetch games for today and tomorrow, limited to 6 games
 * @returns {Promise<Array>} List of games sorted by scheduled time
 */
async function fetchTodayTomorrowGames() {
  const { today, tomorrow } = getTodayTomorrow();

  console.log(`[Sportradar] Fetching games for ${today} and ${tomorrow}`);

  const [todayGames, tomorrowGames] = await Promise.all([
    fetchGames(today),
    fetchGames(tomorrow),
  ]);

  const allGames = [...todayGames, ...tomorrowGames];

  // Sort by scheduled time
  allGames.sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled));

  // Limit to 6 games
  const limitedGames = allGames.slice(0, 6);

  console.log(`[Sportradar] Returning ${limitedGames.length} games (max 6)`);

  return limitedGames;
}

module.exports = {
  fetchGames,
  fetchTodayTomorrowGames,
  getTodayTomorrow,
};
