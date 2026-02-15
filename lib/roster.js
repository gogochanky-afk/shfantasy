const { getLatestRoster, saveRosterSnapshot } = require("./db");

// Demo players pool (20 players with varying costs)
const DEMO_PLAYERS = [
  { id: "p1", name: "LeBron James", team_abbr: "LAL", position: "SF", price: 4 },
  { id: "p2", name: "Stephen Curry", team_abbr: "GSW", position: "PG", price: 4 },
  { id: "p3", name: "Giannis Antetokounmpo", team_abbr: "MIL", position: "PF", price: 4 },
  { id: "p4", name: "Luka Doncic", team_abbr: "DAL", position: "PG", price: 4 },
  { id: "p5", name: "Nikola Jokic", team_abbr: "DEN", position: "C", price: 4 },
  { id: "p6", name: "Jayson Tatum", team_abbr: "BOS", position: "SF", price: 3 },
  { id: "p7", name: "Kevin Durant", team_abbr: "PHX", position: "SF", price: 3 },
  { id: "p8", name: "Joel Embiid", team_abbr: "PHI", position: "C", price: 3 },
  { id: "p9", name: "Damian Lillard", team_abbr: "MIL", position: "PG", price: 3 },
  { id: "p10", name: "Anthony Davis", team_abbr: "LAL", position: "PF", price: 3 },
  { id: "p11", name: "Devin Booker", team_abbr: "PHX", position: "SG", price: 2 },
  { id: "p12", name: "Ja Morant", team_abbr: "MEM", position: "PG", price: 2 },
  { id: "p13", name: "Trae Young", team_abbr: "ATL", position: "PG", price: 2 },
  { id: "p14", name: "Zion Williamson", team_abbr: "NOP", position: "PF", price: 2 },
  { id: "p15", name: "Bam Adebayo", team_abbr: "MIA", position: "C", price: 2 },
  { id: "p16", name: "De'Aaron Fox", team_abbr: "SAC", position: "PG", price: 1 },
  { id: "p17", name: "Tyrese Haliburton", team_abbr: "IND", position: "PG", price: 1 },
  { id: "p18", name: "Paolo Banchero", team_abbr: "ORL", position: "PF", price: 1 },
  { id: "p19", name: "Franz Wagner", team_abbr: "ORL", position: "SF", price: 1 },
  { id: "p20", name: "Cade Cunningham", team_abbr: "DET", position: "PG", price: 1 },
];

/**
 * Generate demo roster for a pool
 * Filters players by teams involved in the game
 * @param {string} poolId
 * @param {string} homeAbbr
 * @param {string} awayAbbr
 * @returns {Object} Roster data
 */
function generateDemoRoster(poolId, homeAbbr, awayAbbr) {
  // Filter players from both teams
  const relevantPlayers = DEMO_PLAYERS.filter(
    (p) => p.team_abbr === homeAbbr || p.team_abbr === awayAbbr
  );

  // If not enough players, add some generic ones
  let players = [...relevantPlayers];
  if (players.length < 10) {
    const additionalPlayers = DEMO_PLAYERS.filter(
      (p) => p.team_abbr !== homeAbbr && p.team_abbr !== awayAbbr
    ).slice(0, 10 - players.length);
    players = [...players, ...additionalPlayers];
  }

  // Ensure at least 20 players
  if (players.length < 20) {
    players = [...DEMO_PLAYERS];
  }

  return {
    pool_id: poolId,
    mode: "demo_roster",
    updated_at: new Date().toISOString(),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team_abbr,
      position: p.position,
      price: p.price,
      injury_status: null,
    })),
  };
}

/**
 * Get or generate roster for a pool
 * @param {string} poolId
 * @param {string} homeAbbr
 * @param {string} awayAbbr
 * @returns {Object} Roster data
 */
function getOrGenerateRoster(poolId, homeAbbr, awayAbbr) {
  // Try to get existing roster
  const existing = getLatestRoster(poolId);
  if (existing) {
    console.log(`[Roster] Using cached roster for ${poolId}`);
    return existing.data;
  }

  // Generate new demo roster
  console.log(`[Roster] Generating demo roster for ${poolId}`);
  const roster = generateDemoRoster(poolId, homeAbbr, awayAbbr);

  // Save to database
  saveRosterSnapshot(poolId, "demo", roster);

  return roster;
}

module.exports = {
  generateDemoRoster,
  getOrGenerateRoster,
  DEMO_PLAYERS,
};
