"use strict";

/**
 * routes/pools.js — Snapshot Playtest Mode
 * SNAPSHOT/DEMO: reads from lib/snapshotStore (local JSON files).
 * LIVE: would call Sportradar (guarded, not implemented here).
 * Zero Sportradar calls in SNAPSHOT mode. Zero DB. Zero better-sqlite3.
 */
const express = require("express");
const router = express.Router();
const { isSnapshot, DATA_MODE } = require("../lib/dataMode");
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function (req, res) {
  try {
    if (isSnapshot()) {
      const result = snapshotStore.getPools();
      return res.json({
        ok: true,
        dataMode: DATA_MODE,
        pools: result,
      });
    }

    res.json({
      ok: false,
      message: "LIVE mode not implemented.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
