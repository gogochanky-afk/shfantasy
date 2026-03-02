"use strict";
const express = require("express");
const router = express.Router();
const { isSnapshot, DATA_MODE } = require("../lib/dataMode");
const snapshotStore = require("../lib/snapshotStore");

router.get("/", function (req, res) {
  try {
    if (isSnapshot()) {
      const players = snapshotStore.getPlayers();
      return res.json({
        ok: true,
        dataMode: DATA_MODE,
        players,
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
