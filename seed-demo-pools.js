const { getOrCreateTeam, upsertPool } = require("./lib/db");

console.log("Seeding demo pools...");

// Get team IDs
const lalId = getOrCreateTeam("LAL", "Los Angeles Lakers");
const gswId = getOrCreateTeam("GSW", "Golden State Warriors");
const milId = getOrCreateTeam("MIL", "Milwaukee Bucks");
const bosId = getOrCreateTeam("BOS", "Boston Celtics");

// Create demo pools for today and tomorrow
const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const demoPools = [
  {
    pool_id: `${today}_demo-game-1`,
    date: today,
    sr_game_id: "demo-game-1",
    home_team_id: lalId,
    away_team_id: gswId,
    lock_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    status: "open",
  },
  {
    pool_id: `${today}_demo-game-2`,
    date: today,
    sr_game_id: "demo-game-2",
    home_team_id: milId,
    away_team_id: bosId,
    lock_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    status: "open",
  },
  {
    pool_id: `${tomorrow}_demo-game-3`,
    date: tomorrow,
    sr_game_id: "demo-game-3",
    home_team_id: gswId,
    away_team_id: milId,
    lock_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(), // tomorrow + 2 hours
    status: "open",
  },
];

demoPools.forEach((pool) => {
  upsertPool(pool);
  console.log(`✅ Created pool: ${pool.pool_id}`);
});

console.log(`✅ Seeded ${demoPools.length} demo pools`);
