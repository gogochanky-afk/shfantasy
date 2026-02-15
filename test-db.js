const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "shfantasy.db");
const db = new Database(dbPath);

console.log("=== Database Check ===");

// Check teams
const teams = db.prepare("SELECT COUNT(*) as count FROM nba_teams").get();
console.log(`Teams: ${teams.count}`);

// Check pools
const pools = db.prepare("SELECT COUNT(*) as count FROM pools").get();
console.log(`Pools: ${pools.count}`);

// Check entries
const entries = db.prepare("SELECT COUNT(*) as count FROM entries").get();
console.log(`Entries: ${entries.count}`);

// List all pools
const allPools = db.prepare(`
  SELECT 
    p.pool_id,
    p.date,
    h.abbr as home,
    a.abbr as away
  FROM pools p
  JOIN nba_teams h ON p.home_team_id = h.id
  JOIN nba_teams a ON p.away_team_id = a.id
`).all();

console.log("\n=== All Pools ===");
allPools.forEach((p) => {
  console.log(`${p.pool_id}: ${p.home} vs ${p.away} (${p.date})`);
});

db.close();
