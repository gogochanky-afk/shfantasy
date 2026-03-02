"use strict";
const express = require("express");
const router = express.Router();
const snapshotStore = require("../lib/snapshotStore");

router.post("/reset", function (req, res) {
  try {
    snapshotStore.reset();
    res.json({ ok: true, message: "Snapshot reset" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
