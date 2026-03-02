"use strict";
const express = require("express");
const router = express.Router();
const snapshotStore = require("../lib/snapshotStore");

router.post("/", function (req, res) {
  try {
    const { entryId, players } = req.body;

    if (!entryId || !players) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const result = snapshotStore.setLineup(entryId, players);
    return res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
