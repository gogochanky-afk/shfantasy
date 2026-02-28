"use strict";

// routes/pools.js — Snapshot Playtest Mode
const express = require("express");
const router  = express.Router();

function buildPools() {
  const now       = Date.now();
  const todayLock = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const tmrwLock  = new Date(now + 26 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "pool-lal-gsw-today",
      label: "Lakers vs Warriors — Today",
      homeTeam: "LAL", awayTeam: "GSW",
      rosterSize: 5, salaryCap: 10,
      lockAt: todayLock, status: "open", dataMode: "SNAPSHOT",
    },
    {
      id: "pool-bos-mia-tmrw",
      label: "Celtics vs Heat — Tomorrow",
      homeTeam: "BOS", awayTeam: "MIA",
      rosterSize: 5, salaryCap: 10,
      lockAt: tmrwLock, status: "open", dataMode: "SNAPSHOT",
    },
  ];
}

router.get("/", function (req, res) {
  res.json({ ok: true, dataMode: "SNAPSHOT", updatedAt: new Date().toISOString(), pools: buildPools() });
});

module.exports = router;
