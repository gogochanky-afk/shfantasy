const express = require("express");
const { getDb } = require("../db/database");

const router = express.Router();

router.post("/join", (req, res) => {
  const { poolId, username } = req.body || {};
  if (!poolId || !username) {
    return res.status(400).json({ error: "poolId and username required" });
  }

  const db = getDb();

  const pool = db.prepare(`SELECT id FROM pools WHERE id = ?`).get(poolId);
  if (!pool) {
    return res.status(404).json({ error: "Pool not found" });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO entries (poolId, username, createdAt)
    VALUES (?, ?, ?)
  `).run(poolId, username.trim(), now);

  res.json({ ok: true, entryId: result.lastInsertRowid });
});

module.exports = router;
