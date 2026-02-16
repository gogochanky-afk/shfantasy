/* scripts/sync-schedule.js
 * Fetch NBA schedule for today+tomorrow (ESPN public endpoint), upsert into SQLite.
 * No API key required.
 */
const Database = require("better-sqlite3");

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function yyyymmdd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "shfantasy/alpha",
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch failed ${res.status} ${res.statusText} url=${url} body=${text.slice(0, 200)}`);
  }
  return res.json();
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

function upsertGame(db, g) {
  const stmt = db.prepare(`
    INSERT INTO games
      (gameId, date, startAt, status, homeCode, homeName, awayCode, awayName, source, updatedAt)
    VALUES
      (@gameId, @date, @startAt, @status, @homeCode, @homeName, @awayCode, @awayName, @source, @updatedAt)
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
  stmt.run(g);
}

function parseEspnScoreboard(json, dateStr) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const out = [];

  for (const ev of events) {
    const gameId = String(ev?.id || "");
    const competitions = ev?.competitions?.[0];
    const comps = Array.isArray(competitions?.competitors) ? competitions.competitors : [];
    const home = comps.find(c => c?.homeAway === "home");
    const away = comps.find(c => c?.homeAway === "away");

    const homeTeam = home?.team || {};
    const awayTeam = away?.team || {};

    const status = competitions?.status?.type?.name || ev?.status?.type?.name || "scheduled";
    const startAt = competitions?.date || ev?.date || null;

    // ESPN sometimes gives abbreviations like "LAL", "GS", etc. We'll store as-is.
    out.push({
      gameId: gameId ? `espn-${gameId}` : `espn-${dateStr}-${Math.random().toString(16).slice(2)}`,
      date: dateStr,
      startAt,
      status,
      homeCode: homeTeam?.abbreviation || null,
      homeName: homeTeam?.displayName || homeTeam?.name || null,
      awayCode: awayTeam?.abbreviation || null,
      awayName: awayTeam?.displayName || awayTeam?.name || null,
      source: "ESPN",
      updatedAt: new Date().toISOString(),
    });
  }

  return out;
}

async function syncSchedule({ dbPath }) {
  const db = new Database(dbPath);
  ensureSchema(db);

  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

  const dates = [today, tomorrow];
  let total = 0;

  for (const d of dates) {
    const dateStr = isoDate(d);
    const ymd = yyyymmdd(d);
    const url =
      process.env.ESPN_SCOREBOARD_URL_TEMPLATE ||
      "https://site.web.api.espn.com/apis/v2/sports/basketball/nba/scoreboard?dates={YYYYMMDD}";
    const finalUrl = url.replace("{YYYYMMDD}", ymd);

    const json = await fetchJson(finalUrl);
    const games = parseEspnScoreboard(json, dateStr);

    const tx = db.transaction((rows) => {
      for (const row of rows) upsertGame(db, row);
    });
    tx(games);

    total += games.length;
  }

  db.close();
  return { ok: true, mode: "LIVE", totalInsertedOrUpdated: total };
}

module.exports = { syncSchedule };
