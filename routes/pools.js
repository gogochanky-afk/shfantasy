// routes/pools.js
// GET /api/pools — returns today + tomorrow demo pools.
//
// DEMO-only: no sqlite / db.js / poolsSnapshot / sportradar dependencies.
// LIVE mode disabled until DB layer is stable on Cloud Run.
//
// Response: { ok, dataMode, updatedAt, pools:[...] }

"use strict";

const express = require("express");
const router  = express.Router();

// ---- Demo data ----
const DEMO_POOLS_BASE = [
  {
    id: "demo-today",
    title: "Demo Pool · Today",
    homeTeam: { abbr: "LAL", name: "Los Angeles Lakers" },
    awayTeam: { abbr: "GSW", name: "Golden State Warriors" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "today",
  },
  {
    id: "demo-tomorrow",
    title: "Demo Pool · Tomorrow",
    homeTeam: { abbr: "BOS", name: "Boston Celtics" },
    awayTeam: { abbr: "MIA", name: "Miami Heat" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "tomorrow",
  },
];

function getDeterministicLockAt() {
  return new Date(Math.floor(Date.now() / 60000) * 60000 + 60000).toISOString();
}

function getDemoPools() {
  const lockAt = getDeterministicLockAt();
  return DEMO_POOLS_BASE.map(function(p) { return Object.assign({}, p, { lockAt: lockAt }); });
}

// ---- Route ----
router.get("/", function (req, res) {
  return res.json({
    ok:        true,
    dataMode:  "DEMO",
    updatedAt: new Date().toISOString(),
    pools:     getDemoPools(),
  });
});

module.exports = router;
