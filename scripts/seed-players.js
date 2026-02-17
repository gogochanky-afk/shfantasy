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
    CREATE INDEX IF NOT EXISTS idx_roster_players_date_team ON roster_players(date, teamId);
  `);
}

function seedPlayers({ dbPath, dates }) {
  const db = new Database(dbPath);
  ensureSchema(db);

  const nowIso = new Date().toISOString();

  // Team IDs are canonical & stable (matches your demo screenshots)
  const teams = [
    { teamId: 1, code: "LAL", name: "Lakers" },
    { teamId: 2, code: "GSW", name: "Warriors" },
    { teamId: 3, code: "BOS", name: "Celtics" },
    { teamId: 4, code: "MIA", name: "Heat" },
  ];

  // ✅ Seed list (editable anytime). Prices 1-4 to fit "cap=10 pick 5"
  // Keep it small & usable first; you can expand later.
  const players = [
    // LAL
    { playerId: "lal-lebron", fullName: "LeBron James", pos: "F", teamId: 1, price: 4 },
    { playerId: "lal-ad", fullName: "Anthony Davis", pos: "C/F", teamId: 1, price: 4 },
    { playerId: "lal-reaves", fullName: "Austin Reaves", pos: "G", teamId: 1, price: 2 },
    { playerId: "lal-russell", fullName: "D'Angelo Russell", pos: "G", teamId: 1, price: 2 },
    { playerId: "lal-rui", fullName: "Rui Hachimura", pos: "F", teamId: 1, price: 1 },

    // GSW
    { playerId: "gsw-curry", fullName: "Stephen Curry", pos: "G", teamId: 2, price: 4 },
    { playerId: "gsw-thompson", fullName: "Klay Thompson", pos: "G", teamId: 2, price: 2 },
    { playerId: "gsw-green", fullName: "Draymond Green", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw-wiggins", fullName: "Andrew Wiggins", pos: "F", teamId: 2, price: 2 },
    { playerId: "gsw-kuminga", fullName: "Jonathan Kuminga", pos: "F", teamId: 2, price: 2 },

    // BOS
    { playerId: "bos-tatum", fullName: "Jayson Tatum", pos: "F", teamId: 3, price: 4 },
    { playerId: "bos-brown", fullName: "Jaylen Brown", pos: "F", teamId: 3, price: 3 },
    { playerId: "bos-white", fullName: "Derrick White", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos-holiday", fullName: "Jrue Holiday", pos: "G", teamId: 3, price: 2 },
    { playerId: "bos-porzingis", fullName: "Kristaps Porziņģis", pos: "C", teamId: 3, price: 3 },

    // MIA
    { playerId: "mia-butler", fullName: "Jimmy Butler", pos: "F", teamId: 4, price: 3 },
    { playerId: "mia-adebayo", fullName: "Bam Adebayo", pos: "C", teamId: 4, price: 3 },
    { playerId: "mia-herro", fullName: "Tyler Herro", pos: "G", teamId: 4, price: 2 },
    { playerId: "mia-robinson", fullName: "Duncan Robinson", pos: "G/F", teamId: 4, price: 1 },
    { playerId: "mia-rozier", fullName: "Terry Rozier", pos: "G", teamId: 4, price: 2 },
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
      isActive=excluded.isActive,
      updatedAt=excluded.updatedAt
  `);

  const clearRoster = db.prepare(`DELETE FROM roster_players WHERE date = ? AND teamId = ?`);
  const insertRoster = db.prepare(`
    INSERT OR IGNORE INTO roster_players (date, teamId, playerId)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const t of teams) upsertTeam.run(t.teamId, t.code, t.name);
    for (const p of players) upsertPlayer.run(p.playerId, p.fullName, p.pos, p.teamId, p.price, nowIso);

    // build roster snapshot for each date and team
    for (const date of dates) {
      for (const t of teams) {
        clearRoster.run(date, t.teamId);
        const teamPlayers = players.filter(x => x.teamId === t.teamId);
        for (const p of teamPlayers) insertRoster.run(date, t.teamId, p.playerId);
      }
    }
  });

  tx();

  // simple summary
  const teamCount = db.prepare(`SELECT COUNT(*) as c FROM teams`).get().c;
  const playerCount = db.prepare(`SELECT COUNT(*) as c FROM players WHERE isActive=1`).get().c;
  const rosterCount = db.prepare(`SELECT COUNT(*) as c FROM roster_players`).get().c;

  db.close();

  return {
    ok: true,
    dbPath,
    dates,
    teams: teamCount,
    players: playerCount,
    rosterRows: rosterCount,
  };
}

if (require.main === module) {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data.sqlite");
  const today = isoDate(new Date());
  const tomorrow = isoDate(addDays(new Date(), 1));
  const result = seedPlayers({ dbPath: DB_PATH, dates: [today, tomorrow] });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { seedPlayers };
