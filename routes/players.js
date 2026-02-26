const express = require("express");
const router = express.Router();

/**
 * GET /api/players
 * Demo players for Draft UI.
 * (Later we can swap to real datasource; for now keep stable schema.)
 */
router.get("/", (req, res) => {
  return res.json({
    ok: true,
    players: [
      { id: "p1", name: "Stephen Curry", team: "GSW", cost: 4 },
      { id: "p2", name: "Jayson Tatum", team: "BOS", cost: 4 },
      { id: "p3", name: "Shai Gilgeous-Alexander", team: "OKC", cost: 4 },
      { id: "p4", name: "Chet Holmgren", team: "OKC", cost: 2 },
      { id: "p5", name: "Karl-Anthony Towns", team: "MIN", cost: 3 },
      { id: "p6", name: "Jrue Holiday", team: "BOS", cost: 2 },
    ],
  });
});

module.exports = router;
