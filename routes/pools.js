"use strict";
/**
 * routes/pools.js — Snapshot Playtest Mode
 * SNAPSHOT/DEMO: reads from lib/snapshotStore (local JSON files).
 * LIVE: would call Sportradar (guarded, not implemented here).
 * Zero Sportradar calls in SNAPSHOT mode. Zero DB. Zero better-sqlite3.
 */
const express       = require("express");
const router        = express.Router();
const { isSnapshot, DATA_MODE } = require("../lib/dataMode");
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function(req, res) {
  try {
    // SNAPSHOT mode: read from local JSON only
    if (isSnapshot()) {
      var result = snapshotStore.getPools();
      return res.json({
        ok: true,
        dataMode: DATA_MODE,
        updatedAt: new Date().toISOString(),
        pools: result.pools
      });
    }
    // LIVE mode: Sportradar integration (circuit-break on error -> SNAPSHOT)
    // TODO: implement LIVE path when Sportradar quota restored
    var snap = snapshotStore.getPools();
    return res.json({
      ok: true,
      dataMode: "SNAPSHOT",
      note: "LIVE path not yet implemented; serving snapshot",
      updatedAt: new Date().toISOString(),
      pools: snap.pools
    });
  } catch (e) {
    console.error("[pools] Error:", e.message);
    // Last-resort: never 500 the client
    try {
      var fallback = snapshotStore.getPools();
      return res.json({ ok:true, dataMode:"SNAPSHOT", note:"error_fallback", updatedAt:new Date().toISOString(), pools:fallback.pools });
    } catch(_) {
      return res.status(500).json({ ok:false, error:"POOLS_ERROR" });
    }
  }
});

module.exports = router;
