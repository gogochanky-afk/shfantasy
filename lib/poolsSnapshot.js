"use strict";

// lib/poolsSnapshot.js
// Store / load last-good pools payload in SQLite (existing db).
// Note: This uses your existing lib/db.js export: { db }

const { db } = require("./db");

function ensureTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pools_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
  `).run();
}

function saveSnapshot(source, poolsArray) {
  ensureTable();
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify({ createdAt, source, pools: poolsArray });

  db.prepare(`
    INSERT INTO pools_snapshot (created_at, source, payload_json)
    VALUES (?, ?, ?)
  `).run(createdAt, source, payloadJson);
}

function loadLatestSnapshot() {
  ensureTable();
  const row = db.prepare(`
    SELECT payload_json
    FROM pools_snapshot
    ORDER BY id DESC
    LIMIT 1
  `).get();

  if (!row || !row.payload_json) return null;

  try {
    const parsed = JSON.parse(row.payload_json);
    if (!parsed || !Array.isArray(parsed.pools)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

module.exports = { saveSnapshot, loadLatestSnapshot };
