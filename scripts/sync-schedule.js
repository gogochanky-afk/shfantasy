const axios = require("axios");
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
const db = new Database(DB_PATH);

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchEspnScoreboard(dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data.events || [];
}

function upsertGame(game) {
  const stmt = db.prepare(`
    INSERT INTO games (gameId, date, startAt, status, homeCode, homeName, awayCode, awayName, source, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(gameId) DO UPDATE SET
      status=excluded.status,
      startAt=excluded.startAt,
      updatedAt=excluded.updatedAt
  `);

  stmt.run(
    game.gameId,
    game.date,
    game.startAt,
    game.status,
    game.homeCode,
    game.homeName,
    game.awayCode,
    game.awayName,
    "ESPN",
    new Date().toISOString()
  );
}

async function syncSchedule({ dryRun = false } = {}) {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);

  const dates = [isoDate(today), isoDate(tomorrow)];
  let total = 0;

  for (const dateStr of dates) {
    const events = await fetchEspnScoreboard(dateStr);

    for (const e of events) {
      const comp = e.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors.find(c => c.homeAway === "home");
      const away = comp.competitors.find(c => c.homeAway === "away");

      const game = {
        gameId: e.id,
        date: dateStr,
        startAt: e.date,
        status: e.status?.type?.name || "scheduled",
        homeCode: home?.team?.abbreviation,
        homeName: home?.team?.displayName,
        awayCode: away?.team?.abbreviation,
        awayName: away?.team?.displayName,
      };

      if (!dryRun) upsertGame(game);
      total++;
    }
  }

  return { ok: true, totalGamesProcessed: total };
}

module.exports = { syncSchedule };
