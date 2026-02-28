"use strict";
// routes/lineup.js — Snapshot Playtest Mode
// GET  /api/lineup?entryId=xxx  -> { ok:true }
// POST /api/lineup  body: { entryId, players:[] } -> { ok:true }
const express = require("express");
const router  = express.Router();

router.get("/", function (req, res) {
  var entryId = String(req.query.entryId || "").trim();
  if (!entryId) return res.status(400).json({ ok:false, error:"entryId required" });
  res.json({ ok:true, entryId:entryId, players:[], note:"lineups stored client-side" });
});

router.post("/", function (req, res) {
  var entryId = String(req.body.entryId || "").trim();
  var players = Array.isArray(req.body.players) ? req.body.players : null;
  if (!entryId) return res.status(400).json({ ok:false, error:"entryId required" });
  if (!players) return res.status(400).json({ ok:false, error:"players array required" });
  res.json({ ok:true, entryId:entryId, saved:true });
});

module.exports = router;
