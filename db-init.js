// db-init.js
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "shfantasy.db");

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Entries: user joins a pool => creates an entry
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poolId TEXT NOT NULL,
      username TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Lineups: 1 entry can have 1 lineup (Alpha)
  db.exec(`
    CREATE TABLE IF NOT EXISTS lineups (
      entryId INTEGER PRIMARY KEY,
      poolId TEXT NOT NULL,
      username TEXT NOT NULL,
      playersJson TEXT NOT NULL,
      totalCost INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Helpful indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entries_username_createdAt
    ON entries(username, createdAt);

    CREATE INDEX IF NOT EXISTS idx_lineups_username_poolId
    ON lineups(username, poolId);
  `);

  return db;
}

module.exports = { initDb, DB_PATH };
