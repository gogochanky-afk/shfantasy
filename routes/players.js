"use strict";
/**
 * routes/players.js — Snapshot Playtest Mode
 * GET /api/players?poolId=xxx
 * SNAPSHOT/DEMO: reads from lib/snapshotStore (local JSON files).
 * LIVE: would call Sportradar (guarded).
 * Zero Sportradar calls in SNAPSHOT mode. Zero DB. Zero better-sqlite3.
 */
const express       = require("express");
const router        = express.Router();
const { isSnapshot, DATA_MODE } = require("../lib/dataMode");
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function(req, res) {
  try {
    var poolId = String(req.query.poolId || "").trim();
    if (isSnapshot()) {
      var result = snapshotStore.getPlayers(poolId);
      return res.json({
        ok: true,
        dataMode: DATA_MODE,
        updatedAt: result.updatedAt,
        poolId: result.poolId,
        players: result.players
      });
    }
    // LIVE mode fallback to snapshot
    var snap = snapshotStore.getPlayers(poolId);
    return res.json({
      ok: true,
      dataMode: "SNAPSHOT",
      note: "LIVE path not yet implemented; serving snapshot",
      updatedAt: snap.updatedAt,
      poolId: snap.poolId,
      players: snap.players
    });
  } catch (e) {
    console.error("[players] Error:", e.message);
    try {
      var fallback = snapshotStore.getPlayers(String(req.query.poolId||""));
      return res.json({ ok:true, dataMode:"SNAPSHOT", note:"error_fallback", updatedAt:new Date().toISOString(), poolId:fallback.poolId, players:fallback.players });
    } catch(_) {
      return res.status(500).json({ ok:false, error:"PLAYERS_ERROR" });
    }
  }
});

module.exports = router;
