// scripts/seed-players.js (REPLACE ENTIRE FILE)

const path = require("path");
const Database = require("better-sqlite3");

/**
 * Seed DEMO data into SQLite:
 * - teams
 * - players
 * - roster_players (today + tomorrow)
 * - games (today + tomorrow)  ✅ this is what makes pools exist
 *
 * Env:
 * - DB_PATH (optional): default ../data.sqlite (same as index.js)
 */
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      teamId INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      playerId TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      pos TEXT,
      teamId INTEGER,
      price INTEGER DEFAULT 2,
      isActive INTEGER DEFAULT 1,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS roster_players (
      date TEXT NOT NULL,
      teamId INTEGER NOT NULL,
      playerId TEXT NOT NULL,
      PRIMARY KEY (date, teamId, playerId)
    );
    CREATE INDEX IF NOT EXISTS idx_roster_date_team ON roster_players(date, teamId);

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

    -- pools table may already exist from index.js; keep compatible
    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      gameId TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT,
      lockAt TEXT,
      salaryCap INTEGER DEFAULT 10,
      rosterSize INTEGER DEFAULT 5,
      entryFee INTEGER DEFAULT 5,
      prize INTEGER DEFAULT 100,
      mode TEXT DEFAULT 'DEMO',
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pools_date ON pools(date);
    CREATE INDEX IF NOT EXISTS idx_pools_gameId ON pools(gameId);
  `);
}

function seedDemoTeamsPlayersRosterGames(db) {
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const nowIso = new Date().toISOString();

  // --- DEMO teams (4)
  const teams = [
    { teamId: 1, code: "LAL", name: "Lakers" },
    { teamId: 2, code: "GSW", name: "Warriors" },
    { teamId: 3, code: "BOS", name: "Celtics" },
    { teamId: 4, code: "MIA", name: "Heat" },
  ];

  // --- DEMO players (20) (5 each team)
  const players = [
    // LAL
    { playerId: "lal-001", fullName: "LeBron James", pos: "F", teamId: 1, price: 4 },
    { playerId: "lal-002", fullName: "Anthony Davis", pos: "C", teamId: 1, price: 4 },
    { playerId: "lal-003", fullName: "D'Angelo Russell", pos: "G", teamId: 1, price: 2 },
    { playerId: "lal-004", fullName: "Austin Reaves", pos: "G", teamId: 1, price: 2 },
    { playerId: "lal-005", fullName: "Rui Hachimura", pos: "F", teamId: 1, price: 1 },

    // GSW
    { playerId: "gsw-001", fullName: "Stephen Curry", pos: "G", teamId: 2, price: 4 },
    { playerId: "gsw-002", fullName: "Klay Thompson", pos: "G", teamId: 2, price: 2 },
    { playerId: "gsw-003", fullName: "Draymond Green", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw-004", fullName: "Andrew Wiggins", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw-005", fullName: "Jonathan Kuminga", pos: "F", teamId: 2, price: 1 },

    // BOS
    { playerId: "bos-001", fullName: "Jayson Tatum", pos: "F", teamId: 3, price: 4 },
    { playerId: "bos-002", fullName: "Jaylen Brown", pos: "F", teamId: 3, price: 3 },
    { playerId: "bos-003", fullName: "Jrue Holiday", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos-004", fullName: "Derrick White", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos-005", fullName: "Kristaps Porzingis", pos: "C", teamId: 3, price: 3 },

    // MIA
    { playerId: "mia-001", fullName: "Jimmy Butler", pos: "F", teamId: 4, price: 3 },
    { playerId: "mia-002", fullName: "Bam Adebayo", pos: "C", teamId: 4, price: 3 },
    { playerId: "mia-003", fullName: "Tyler Herro", pos: "G", teamId: 4, price: 2 },
    { playerId: "mia-004", fullName: "Terry Rozier", pos: "G", teamId: 4, price: 2 },
    { playerId: "mia-005", fullName: "Duncan Robinson", pos: "G", teamId: 4, price: 1 },
  ];

  // --- DEMO games (today+tomorrow)
  // IMPORTANT: gameId format matches pools id logic in index.js: `${date}-${gameId}`
  const games = [
    {
      gameId: `demo-${today}-001`,
      date: today,
      startAt: `${today}T11:00:00.000Z`,
      status: "SCHEDULED",
      homeCode: "LAL",
      homeName: "Lakers",
      awayCode: "GSW",
      awayName: "Warriors",
      source: "DEMO",
      updatedAt: nowIso,
    },
    {
      gameId: `demo-${today}-002`,
      date: today,
      startAt: `${today}T13:30:00.000Z`,
      status: "SCHEDULED",
      homeCode: "BOS",
      homeName: "Celtics",
      awayCode: "MIA",
      awayName: "Heat",
      source: "DEMO",
      updatedAt: nowIso,
    },
    {
      gameId: `demo-${tomorrow}-001`,
      date: tomorrow,
      startAt: `${tomorrow}T11:00:00.000Z`,
      status: "SCHEDULED",
      homeCode: "LAL",
      homeName: "Lakers",
      awayCode: "GSW",
      awayName: "Warriors",
      source: "DEMO",
      updatedAt: nowIso,
    },
    {
      gameId: `demo-${tomorrow}-002`,
      date: tomorrow,
      startAt: `${tomorrow}T13:30:00.000Z`,
      status: "SCHEDULED",
      homeCode: "BOS",
      homeName: "Celtics",
      awayCode: "MIA",
      awayName: "Heat",
      source: "DEMO",
      updatedAt: nowIso,
    },
  ];

  // ---------- Upserts ----------
  const upsertTeam = db.prepare(`
    INSERT INTO teams (teamId, code, name)
    VALUES (?, ?, ?)
    ON CONFLICT(teamId) DO UPDATE SET
      code=excluded.code,
      name=excluded.name
  `);

  const upsertPlayer = db.prepare(`
    INSERT INTO players (playerId, fullName, pos, teamId, price, isActive, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(playerId) DO UPDATE SET
      fullName=excluded.fullName,
      pos=excluded.pos,
      teamId=excluded.teamId,
      price=excluded.price,
      isActive=excluded.isActive,
      updatedAt=excluded.updatedAt
  `);

  const upsertGame = db.prepare(`
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

  const upsertRoster = db.prepare(`
    INSERT OR IGNORE INTO roster_players (date, teamId, playerId)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // teams
    for (const t of teams) upsertTeam.run(t.teamId, t.code, t.name);

    // players
    for (const p of players) {
      upsertPlayer.run(
        p.playerId,
        p.fullName,
        p.pos,
        p.teamId,
        p.price,
        1,
        nowIso
      );
    }

    // roster: today + tomorrow (all players active for both days)
    for (const d of [today, tomorrow]) {
      for (const p of players) {
        upsertRoster.run(d, p.teamId, p.playerId);
      }
    }

    // games
    for (const g of games) {
      upsertGame.run(
        g.gameId,
        g.date,
        g.startAt,
        g.status,
        g.homeCode,
        g.homeName,
        g.awayCode,
        g.awayName,
        g.source,
        g.updatedAt
      );
    }
  });

  tx();

  return {
    ok: true,
    dbPath: db.name || "sqlite",
    dates: [today, tomorrow],
    teams: teams.length,
    players: players.length,
    rosterRows: players.length * 2,
    games: games.length,
  };
}

async function seedPlayers({ dryRun = false } = {}) {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
  const db = new Database(DB_PATH);

  try {
    ensureSchema(db);

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        message: "dryRun=true; schema ensured only",
        dbPath: DB_PATH,
      };
    }

    const result = seedDemoTeamsPlayersRosterGames(db);
    return { ok: true, result };
  } finally {
    db.close();
  }
}

module.exports = { seedPlayers };
