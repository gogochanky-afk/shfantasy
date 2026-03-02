"use strict";
const express = require("express");
const router = express.Router();
const snapshotStore = require("../lib/snapshotStore");
const { isSnapshot } = require("../lib/dataMode");

router.get("/my-entries", function (req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    if (isSnapshot()) {
      const entries = snapshotStore.getUserEntries(userId);
      return res.json({ ok: true, entries });
    }

    res.json({ ok: false, message: "LIVE mode not implemented." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
