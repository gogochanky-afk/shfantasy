const path = require("path");
const Database = require("better-sqlite3");

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
  `);
}

function seedPlayers() {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
  const db = new Database(DB_PATH);
  ensureSchema(db);

  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const dates = [today, tomorrow];

  const nowIso = new Date().toISOString();

  // ---- Teams (keep IDs stable) ----
  const TEAMS = [
    { teamId: 1, code: "LAL", name: "Lakers" },
    { teamId: 2, code: "GSW", name: "Warriors" },
    { teamId: 3, code: "BOS", name: "Celtics" },
    { teamId: 4, code: "MIA", name: "Heat" }
  ];

  // ---- Players (示範版：真名 + 價錢 1-4；之後可擴到全聯盟) ----
  // Lakers (5)
  const PLAYERS = [
    { playerId: "lal_lebron", fullName: "LeBron James", pos: "F", teamId: 1, price: 4 },
    { playerId: "lal_davis", fullName: "Anthony Davis", pos: "C", teamId: 1, price: 4 },
    { playerId: "lal_reaves", fullName: "Austin Reaves", pos: "G", teamId: 1, price: 3 },
    { playerId: "lal_russell", fullName: "D'Angelo Russell", pos: "G", teamId: 1, price: 2 },
    { playerId: "lal_hachimura", fullName: "Rui Hachimura", pos: "F", teamId: 1, price: 1 },

    // Warriors (5)
    { playerId: "gsw_curry", fullName: "Stephen Curry", pos: "G", teamId: 2, price: 4 },
    { playerId: "gsw_thompson", fullName: "Klay Thompson", pos: "G", teamId: 2, price: 2 },
    { playerId: "gsw_green", fullName: "Draymond Green", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw_wiggins", fullName: "Andrew Wiggins", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw_kuminga", fullName: "Jonathan Kuminga", pos: "F", teamId: 2, price: 2 },

    // Celtics (5)
    { playerId: "bos_tatum", fullName: "Jayson Tatum", pos: "F", teamId: 3, price: 4 },
    { playerId: "bos_brown", fullName: "Jaylen Brown", pos: "F", teamId: 3, price: 3 },
    { playerId: "bos_holiday", fullName: "Jrue Holiday", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos_white", fullName: "Derrick White", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos_porzingis", fullName: "Kristaps Porzingis", pos: "C", teamId: 3, price: 3 },

    // Heat (5)
    { playerId: "mia_butler", fullName: "Jimmy Butler", pos: "F", teamId: 4, price: 4 },
    { playerId: "mia_adebayo", fullName: "Bam Adebayo", pos: "C", teamId: 4, price: 3 },
    { playerId: "mia_herro", fullName: "Tyler Herro", pos: "G", teamId: 4, price: 2 },
    { playerId: "mia_robinson", fullName: "Duncan Robinson", pos: "G", teamId: 4, price: 1 },
    { playerId: "mia_jacquez", fullName: "Jaime Jaquez Jr.", pos: "F", teamId: 4, price: 1 }
  ];

  const upsertTeam = db.prepare(`
    INSERT INTO teams (teamId, code, name)
    VALUES (?, ?, ?)
    ON CONFLICT(teamId) DO UPDATE SET
      code=excluded.code,
      name=excluded.name
  `);

  const upsertPlayer = db.prepare(`
    INSERT INTO players (playerId, fullName, pos, teamId, price, isActive, updatedAt)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(playerId) DO UPDATE SET
      fullName=excluded.fullName,
      pos=excluded.pos,
      teamId=excluded.teamId,
      price=excluded.price,
      isActive=1,
      updatedAt=excluded.updatedAt
  `);

  const insertRoster = db.prepare(`
    INSERT OR IGNORE INTO roster_players (date, teamId, playerId)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // teams
    for (const t of TEAMS) upsertTeam.run(t.teamId, t.code, t.name);

    // players
    for (const p of PLAYERS) {
      upsertPlayer.run(p.playerId, p.fullName, p.pos, p.teamId, p.price, nowIso);
    }

    // roster snapshots for today+tomorrow
    for (const d of dates) {
      for (const p of PLAYERS) insertRoster.run(d, p.teamId, p.playerId);
    }
  });

  tx();

  const teamCount = db.prepare(`SELECT COUNT(*) as c FROM teams`).get().c;
  const playerCount = db.prepare(`SELECT COUNT(*) as c FROM players`).get().c;
  const rosterCount = db.prepare(`SELECT COUNT(*) as c FROM roster_players WHERE date IN (?, ?)`)
    .get(today, tomorrow).c;

  db.close();

  return {
    ok: true,
    dbPath: DB_PATH,
    dates,
    teams: teamCount,
    players: playerCount,
    rosterRows: rosterCount
  };
}

module.exports = { seedPlayers };
