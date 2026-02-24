// /routes/players.js
const express = require("express");
const router = express.Router();

/**
 * GET /api/players
 * Returns demo players list for Draft.
 */
router.get("/", (req, res) => {
  // Demo players (你之後可以換成 DB / Sportradar / snapshot)
  const players = [
    { id: "p1", name: "LeBron James", team: "LAL", cost: 4 },
    { id: "p2", name: "Stephen Curry", team: "GSW", cost: 4 },
    { id: "p3", name: "Jayson Tatum", team: "BOS", cost: 3 },
    { id: "p4", name: "Shai Gilgeous-Alexander", team: "OKC", cost: 3 },
    { id: "p5", name: "Bam Adebayo", team: "MIA", cost: 2 },
    { id: "p6", name: "Mikal Bridges", team: "BKN", cost: 2 },
    { id: "p7", name: "Alex Caruso", team: "OKC", cost: 1 },
    { id: "p8", name: "Austin Reaves", team: "LAL", cost: 1 },
  ];

  return res.status(200).json({
    ok: true,
    players,
    ts: new Date().toISOString(),
  });
});

module.exports = router;
