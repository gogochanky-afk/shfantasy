const axios = require("axios");
const path = require("path");
const Database = require("better-sqlite3");

/**
 * Sync NBA schedule (today + tomorrow) into SQLite games table.
 * Source: data.nba.net (no API key)
 *
 * Env:
 * - DB_PATH (optional): default ../data.sqlite
 *
 * Returns:
 * { ok:true, source:"NBA_DATA_NET", dates:[today,tomorrow], fetchedGames:n, gamesUpserted:n }
 *
 * If external fetch fails, returns ok:false with rich error details (status/url/responseSnippet).
 */

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      gameId TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      startAt TEXT,
      status TEXT,
      homeCode TEXT,
      homeName TEXT,
      awayCode TEXT,
      awayName TEXT,
      source TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
  `);
}

function safeAxiosError(e) {
  const status = e?.response?.status;
  const url = e?.config?.url;
  let snippet = "";

  try {
    const data = e?.response?.data;
    if (typeof data === "string") snippet = data.slice(0, 500);
    else if (data) snippet = JSON.stringify(data).slice(0, 500);
  } catch (_) {}

  return {
    message: String(e?.message || e),
    status: status || null,
    url: url || null,
    responseSnippet: snippet || null,
  };
}

// Map NBA team triCode to a readable name (best-effort)
const TEAM_NAME_BY_CODE = {
  ATL: "Hawks",
  BOS: "Celtics",
  BKN: "Nets",
  CHA: "Hornets",
  CHI: "Bulls",
  CLE: "Cavaliers",
  DAL: "Mavericks",
  DEN: "Nuggets",
  DET: "Pistons",
  GSW: "Warriors",
  HOU: "Rockets",
  IND: "Pacers",
  LAC: "Clippers",
  LAL: "Lakers",
  MEM: "Grizzlies",
  MIA: "Heat",
  MIL: "Bucks",
  MIN: "Timberwolves",
  NOP: "Pelicans",
  NYK: "Knicks",
  OKC: "Thunder",
  ORL: "Magic",
  PHI: "76ers",
  PHX: "Suns",
  POR: "Trail Blazers",
  SAC: "Kings",
  SAS: "Spurs",
  TOR: "Raptors",
  UTA: "Jazz",
  WAS: "Wizards",
};

async function fetchNbaScheduleJson() {
  // NBA data feed (usually stable). If it ever changes, we will see it in responseSnippet.
  // This endpoint returns a season schedule structure.
  const url = "https://data.nba.net/prod/v2/2025/schedule.json";
  const resp = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "shfantasy/1.0 (cloudrun)",
      Accept: "application/json",
    },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return resp.data;
}

function normalizeGames(scheduleJson, wantedDates) {
  // Expected shape: { league: { standard: [ { gameId, startTimeUTC, hTeam:{triCode}, vTeam:{triCode}, statusNum } ] } }
  // But NBA feed sometimes is { league:{ standard:[...] } } or { league:{ standard:{...} } }
  const standard = scheduleJson?.league?.standard;
  const gamesArr = Array.isArray(standard) ? standard : Array.isArray(standard?.games) ? standard.games : [];
  const out = [];

  for (const g of gamesArr) {
    const startUtc = g?.startTimeUTC || g?.startTimeUTC || g?.startTimeUTC;
    if (!startUtc) continue;

    const date = isoDate(new Date(startUtc));
    if (!wantedDates.has(date)) continue;

    const homeCode = g?.hTeam?.triCode || g?.hTeam?.teamTricode || g?.homeTeam?.teamTricode || "";
    const awayCode = g?.vTeam?.triCode || g?.vTeam?.teamTricode || g?.awayTeam?.teamTricode || "";

    // statusNum: 1 scheduled, 2 live, 3 finished (NBA feed typical)
    const statusNum = Number(g?.statusNum || 1);
    const status =
      statusNum === 1 ? "scheduled" :
      statusNum === 2 ? "live" :
      statusNum === 3 ? "final" : "scheduled";

    const gameId = String(g?.gameId || g?.gameCode || `${date}-${awayCode}-${homeCode}`);

    out.push({
      gameId,
      date,
      startAt: new Date(startUtc).toISOString(),
      status,
      homeCode,
      homeName: TEAM_NAME_BY_CODE[homeCode] || homeCode || "HOME",
      awayCode,
      awayName: TEAM_NAME_BY_CODE[awayCode] || awayCode || "AWAY",
      source: "NBA_DATA_NET",
    });
  }

  return out;
}

async function syncSchedule({ dryRun = false } = {}) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const wantedDates = new Set([today, tomorrow]);

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
  const db = new Database(DB_PATH);
  ensureSchema(db);

  try {
    const json = await fetchNbaScheduleJson();
    const games = normalizeGames(json, wantedDates);

    const upsert = db.prepare(`
      INSERT INTO games (gameId, date, startAt, status, homeCode, homeName, awayCode, awayName, source, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(gameId) DO UPDATE SET
        date=excluded.date,
        startAt=excluded.startAt,
        status=excluded.status,
        homeCode=excluded.homeCode,
        homeName=excluded.homeName,
        awayCode=excluded.awayCode,
        awayName=excluded.awayName,
        source=excluded.source,
        updatedAt=excluded.updatedAt
    `);

    const nowIso = new Date().toISOString();
    let gamesUpserted = 0;

    if (!dryRun) {
      const tx = db.transaction(() => {
        for (const g of games) {
          upsert.run(
            g.gameId,
            g.date,
            g.startAt,
            g.status,
            g.homeCode,
            g.homeName,
            g.awayCode,
            g.awayName,
            g.source,
            nowIso
          );
          gamesUpserted++;
        }
      });
      tx();
    }

    return {
      ok: true,
      source: "NBA_DATA_NET",
      dates: [today, tomorrow],
      fetchedGames: games.length,
      gamesUpserted: dryRun ? 0 : gamesUpserted,
      dryRun,
      dbPath: DB_PATH,
    };
  } catch (e) {
    const info = safeAxiosError(e);
    return {
      ok: false,
      error: "SYNC_SCHEDULE_FAILED",
      ...info,
      dates: [today, tomorrow],
      dbPath: DB_PATH,
    };
  } finally {
    try { db.close(); } catch (_) {}
  }
}

module.exports = { syncSchedule };
