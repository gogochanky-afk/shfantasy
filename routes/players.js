"use strict";
/**
 * routes/players.js — Snapshot Playtest Mode
 * GET /api/players?poolId=xxx
 * Reads from lib/snapshotStore.js (which reads data/snapshot_players.json).
 * Zero Sportradar. Zero DB. Zero better-sqlite3.
 */

const express       = require("express");
const router        = express.Router();
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function (req, res) {
  try {
    var poolId = String(req.query.poolId || "").trim();
    var result = snapshotStore.getPlayers(poolId);
    res.json({
      ok: true,
      dataMode: result.dataMode || "SNAPSHOT",
      updatedAt: result.updatedAt,
      poolId: result.poolId,
      players: result.players
    });
  } catch (e) {
    console.error("[players] Error:", e.message);
    res.status(500).json({ ok: false, error: "PLAYERS_ERROR", detail: e.message });
  }
});

module.exports = router;
