const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "..", "shfantasy.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

/**
 * Get or create team by abbreviation
 * @param {string} abbr - Team abbreviation
 * @param {string} name - Team name
 * @param {string} srTeamId - Sportradar team ID (optional)
 * @returns {number} Team ID
 */
function getOrCreateTeam(abbr, name, srTeamId = null) {
  let team = db.prepare("SELECT id FROM nba_teams WHERE abbr = ?").get(abbr);

  if (!team) {
    const insert = db.prepare(`
      INSERT INTO nba_teams (abbr, name, sr_team_id) 
      VALUES (?, ?, ?)
    `);
    const result = insert.run(abbr, name, srTeamId);
    return result.lastInsertRowid;
  }

  // Update sr_team_id if provided and not set
  if (srTeamId && !team.sr_team_id) {
    db.prepare("UPDATE nba_teams SET sr_team_id = ? WHERE id = ?").run(
      srTeamId,
      team.id
    );
  }

  return team.id;
}

/**
 * Upsert pool (deterministic by pool_id)
 * @param {Object} pool
 * @returns {string} pool_id
 */
function upsertPool(pool) {
  const existing = db.prepare("SELECT pool_id FROM pools WHERE pool_id = ?").get(pool.pool_id);

  if (existing) {
    // Update existing pool
    db.prepare(`
      UPDATE pools 
      SET lock_time = ?, status = ?
      WHERE pool_id = ?
    `).run(pool.lock_time, pool.status, pool.pool_id);
  } else {
    // Insert new pool
    db.prepare(`
      INSERT INTO pools (pool_id, date, sr_game_id, home_team_id, away_team_id, lock_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      pool.pool_id,
      pool.date,
      pool.sr_game_id,
      pool.home_team_id,
      pool.away_team_id,
      pool.lock_time,
      pool.status
    );
  }

  return pool.pool_id;
}

/**
 * Get pools for today and tomorrow
 * @returns {Array} List of pools with team info
 */
function getTodayTomorrowPools() {
  const rows = db.prepare(`
    SELECT 
      p.pool_id,
      p.date,
      p.sr_game_id,
      p.lock_time,
      p.status,
      h.abbr as home_abbr,
      h.name as home_name,
      a.abbr as away_abbr,
      a.name as away_name
    FROM pools p
    JOIN nba_teams h ON p.home_team_id = h.id
    JOIN nba_teams a ON p.away_team_id = a.id
    WHERE p.date >= date('now')
    ORDER BY p.lock_time ASC
    LIMIT 6
  `).all();

  return rows.map((row) => ({
    pool_id: row.pool_id,
    date: row.date,
    sr_game_id: row.sr_game_id,
    lock_time: row.lock_time,
    status: row.status,
    home: { abbr: row.home_abbr, name: row.home_name },
    away: { abbr: row.away_abbr, name: row.away_name },
  }));
}

/**
 * Get latest roster snapshot for a pool
 * @param {string} poolId
 * @returns {Object|null} Roster snapshot
 */
function getLatestRoster(poolId) {
  const row = db.prepare(`
    SELECT id, pool_id, captured_at, source, data_json, checksum
    FROM roster_snapshots
    WHERE pool_id = ?
    ORDER BY captured_at DESC
    LIMIT 1
  `).get(poolId);

  if (!row) return null;

  return {
    id: row.id,
    pool_id: row.pool_id,
    captured_at: row.captured_at,
    source: row.source,
    data: JSON.parse(row.data_json),
    checksum: row.checksum,
  };
}

/**
 * Save roster snapshot
 * @param {string} poolId
 * @param {string} source - "demo" | "sportradar"
 * @param {Object} data - Roster data
 * @returns {number} Snapshot ID
 */
function saveRosterSnapshot(poolId, source, data) {
  const dataJson = JSON.stringify(data);
  const checksum = crypto.createHash("md5").update(dataJson).digest("hex");

  const result = db.prepare(`
    INSERT INTO roster_snapshots (pool_id, source, data_json, checksum)
    VALUES (?, ?, ?, ?)
  `).run(poolId, source, dataJson, checksum);

  return result.lastInsertRowid;
}

/**
 * Save entry
 * @param {Object} entry
 * @returns {string} entry_id
 */
function saveEntry(entry) {
  db.prepare(`
    INSERT INTO entries (entry_id, pool_id, player_ids, total_cost, status, score, rank)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.entry_id,
    entry.pool_id,
    JSON.stringify(entry.player_ids),
    entry.total_cost,
    entry.status,
    entry.score,
    entry.rank
  );

  return entry.entry_id;
}

/**
 * Get all entries
 * @returns {Array} List of entries
 */
function getAllEntries() {
  const rows = db.prepare(`
    SELECT entry_id, pool_id, player_ids, total_cost, status, score, rank, created_at
    FROM entries
    ORDER BY created_at DESC
  `).all();

  return rows.map((row) => ({
    entry_id: row.entry_id,
    pool_id: row.pool_id,
    player_ids: JSON.parse(row.player_ids),
    total_cost: row.total_cost,
    status: row.status,
    score: row.score,
    rank: row.rank,
    created_at: row.created_at,
  }));
}

module.exports = {
  db,
  getOrCreateTeam,
  upsertPool,
  getTodayTomorrowPools,
  getLatestRoster,
  saveRosterSnapshot,
  saveEntry,
  getAllEntries,
};
