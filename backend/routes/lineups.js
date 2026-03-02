"use strict";
const express = require("express");
const router = express.Router();
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function (req, res) {
  try {
    const lineupList = snapshotStore.getAllLineups();
    return res.json({ ok: true, lineups: lineupList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
