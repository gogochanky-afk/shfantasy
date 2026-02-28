"use strict";
/**
 * routes/pools.js — Snapshot Playtest Mode
 * Reads from lib/snapshotStore.js (which reads data/snapshot_pools.json).
 * Zero Sportradar. Zero DB. Zero better-sqlite3.
 */

const express       = require("express");
const router        = express.Router();
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function (req, res) {
  try {
    var result = snapshotStore.getPools();
    res.json({
      ok: true,
      dataMode: result.dataMode || "SNAPSHOT",
      updatedAt: new Date().toISOString(),
      pools: result.pools
    });
  } catch (e) {
    console.error("[pools] Error:", e.message);
    res.status(500).json({ ok: false, error: "POOLS_ERROR", detail: e.message });
  }
});

module.exports = router;
