const express = require("express");
const { getDb } = require("../db/database");

const router = express.Router();

router.get("/pools", (req, res) => {
  const db = getDb();
  const pools = db.prepare(`
    SELECT id, name, date, salaryCap, rosterSize
    FROM pools
    ORDER BY CASE date WHEN 'today' THEN 0 WHEN 'tomorrow' THEN 1 ELSE 9 END, name
  `).all();

  res.json({ mode: "DEMO", pools });
});

module.exports = router;
