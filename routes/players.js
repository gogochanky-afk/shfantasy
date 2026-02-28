"use strict";
/**
 * routes/players.js — Snapshot Playtest Mode
 * GET /api/players?poolId=xxx[&includeInactive=1]
 * SNAPSHOT/DEMO: reads from lib/snapshotStore (local JSON files).
 * LIVE: would call Sportradar (guarded).
 * Zero Sportradar calls in SNAPSHOT mode. Zero DB. Zero better-sqlite3.
 *
 * Query params:
 *   poolId          (required) — pool identifier
 *   includeInactive (optional) — if "1" or "true", return ALL players including
 *                                out/inactive (for debugging); default = playable only
 */
const express       = require("express");
const router        = express.Router();
const { isSnapshot, DATA_MODE } = require("../lib/dataMode");
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function(req, res) {
  try {
    var poolId          = String(req.query.poolId || "").trim();
    var includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";

    if (isSnapshot()) {
      var result  = snapshotStore.getPlayers(poolId);
      var players = filterPlayers(result.players, includeInactive);
      return res.json({
        ok:        true,
        dataMode:  DATA_MODE,
        updatedAt: result.updatedAt,
        poolId:    result.poolId,
        players:   players,
      });
    }
    // LIVE mode fallback to snapshot
    var snap    = snapshotStore.getPlayers(poolId);
    var players = filterPlayers(snap.players, includeInactive);
    return res.json({
      ok:        true,
      dataMode:  "SNAPSHOT",
      note:      "LIVE path not yet implemented; serving snapshot",
      updatedAt: snap.updatedAt,
      poolId:    snap.poolId,
      players:   players,
    });
  } catch (e) {
    console.error("[players] Error:", e.message);
    try {
      var fallback = snapshotStore.getPlayers(String(req.query.poolId || ""));
      return res.json({
        ok:        true,
        dataMode:  "SNAPSHOT",
        note:      "error_fallback",
        updatedAt: new Date().toISOString(),
        poolId:    fallback.poolId,
        players:   fallback.players,
      });
    } catch (_) {
      return res.status(500).json({ ok: false, error: "PLAYERS_ERROR" });
    }
  }
});

/**
 * Filter players based on isPlayable field.
 * - Default: return only players where isPlayable===true OR isPlayable is
 *   undefined (legacy snapshots without the field — always include)
 * - includeInactive=true: return all players regardless of status
 */
function filterPlayers(players, includeInactive) {
  if (!Array.isArray(players)) return [];
  if (includeInactive) return players;
  return players.filter(function(p) {
    if (p.isPlayable === undefined || p.isPlayable === null) return true;
    return p.isPlayable === true;
  });
}

module.exports = router;
