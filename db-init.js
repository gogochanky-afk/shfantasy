const Database = require("better-sqlite3");
const path = require("path");

// Initialize database
const dbPath = path.join(__dirname, "shfantasy.db");
const db = new Database(dbPath);

console.log("Initializing database schema...");

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Create tables (additive only - no destructive changes)

// 1. nba_teams (canonical)
db.exec(`
  CREATE TABLE IF NOT EXISTS nba_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sr_team_id TEXT UNIQUE,
    abbr TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. team_mappings (extensible)
db.exec(`
  CREATE TABLE IF NOT EXISTS team_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_team_id TEXT NOT NULL,
    canonical_team_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canonical_team_id) REFERENCES nba_teams(id),
    UNIQUE(source, source_team_id)
  )
`);

// 3. pools (deterministic)
db.exec(`
  CREATE TABLE IF NOT EXISTS pools (
    pool_id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    sr_game_id TEXT,
    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,
    lock_time DATETIME NOT NULL,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES nba_teams(id),
    FOREIGN KEY (away_team_id) REFERENCES nba_teams(id)
  )
`);

// 4. roster_snapshots (single source of truth)
db.exec(`
  CREATE TABLE IF NOT EXISTS roster_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id TEXT NOT NULL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    data_json TEXT NOT NULL,
    checksum TEXT,
    FOREIGN KEY (pool_id) REFERENCES pools(pool_id)
  )
`);

// Create index for faster roster lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_roster_pool_id 
  ON roster_snapshots(pool_id, captured_at DESC)
`);

// 5. entries (if not exists)
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT UNIQUE NOT NULL,
    pool_id TEXT NOT NULL,
    player_ids TEXT NOT NULL,
    total_cost INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    score INTEGER DEFAULT 0,
    rank INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pool_id) REFERENCES pools(pool_id)
  )
`);

console.log("✅ Database schema initialized");

// Seed demo teams
const teams = [
  { abbr: "LAL", name: "Los Angeles Lakers" },
  { abbr: "GSW", name: "Golden State Warriors" },
  { abbr: "MIL", name: "Milwaukee Bucks" },
  { abbr: "DAL", name: "Dallas Mavericks" },
  { abbr: "DEN", name: "Denver Nuggets" },
  { abbr: "BOS", name: "Boston Celtics" },
  { abbr: "PHX", name: "Phoenix Suns" },
  { abbr: "PHI", name: "Philadelphia 76ers" },
  { abbr: "MEM", name: "Memphis Grizzlies" },
  { abbr: "MIA", name: "Miami Heat" },
  { abbr: "ATL", name: "Atlanta Hawks" },
  { abbr: "NOP", name: "New Orleans Pelicans" },
  { abbr: "SAC", name: "Sacramento Kings" },
  { abbr: "IND", name: "Indiana Pacers" },
  { abbr: "ORL", name: "Orlando Magic" },
  { abbr: "DET", name: "Detroit Pistons" },
];

const insertTeam = db.prepare(`
  INSERT OR IGNORE INTO nba_teams (abbr, name) 
  VALUES (?, ?)
`);

teams.forEach((team) => {
  insertTeam.run(team.abbr, team.name);
});

console.log(`✅ Seeded ${teams.length} teams`);

db.close();
console.log("✅ Database initialization complete");
