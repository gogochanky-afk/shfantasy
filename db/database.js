const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "shfantasy.db");

let db;

function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function initDb() {
  const db = getDb();

  // pools: demo pools for Today/Tomorrow
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      salaryCap INTEGER NOT NULL,
      rosterSize INTEGER NOT NULL
    )
  `).run();

  // entries: join records
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poolId TEXT NOT NULL,
      username TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `).run();

  // seed demo pools if empty
  const count = db.prepare(`SELECT COUNT(*) as c FROM pools`).get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO pools (id, name, date, salaryCap, rosterSize)
      VALUES (?, ?, ?, ?, ?)
    `);

    insert.run("demo-today", "Today Arena", "today", 10, 5);
    insert.run("demo-tomorrow", "Tomorrow Arena", "tomorrow", 10, 5);
  }
}

module.exports = { getDb, initDb };
