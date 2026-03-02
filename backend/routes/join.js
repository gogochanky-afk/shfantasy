"use strict";
const express = require("express");
const router = express.Router();
const snapshotStore = require("../lib/snapshotStore");
const { isSnapshot } = require("../lib/dataMode");

router.post("/", function (req, res) {
  try {
    const { userId, poolId } = req.body;

    if (!userId || !poolId) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    if (isSnapshot()) {
      const entry = snapshotStore.joinPool(userId, poolId);
      return res.json({ ok: true, entry });
    }

    res.json({ ok: false, message: "LIVE mode not implemented." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
