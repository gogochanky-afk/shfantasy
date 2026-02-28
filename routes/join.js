"use strict";
// routes/join.js — Snapshot Playtest Mode
// POST /api/join  body: { username, poolId }
// Returns { ok:true, entryId, poolId, username }
const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");

router.post("/", function (req, res) {
  var username = String(req.body.username || "").trim();
  var poolId   = String(req.body.poolId   || "").trim();
  if (!username) return res.status(400).json({ ok:false, error:"username required" });
  if (!poolId)   return res.status(400).json({ ok:false, error:"poolId required" });
  var entryId = "e-" + crypto.randomBytes(6).toString("hex");
  res.json({ ok:true, entryId:entryId, poolId:poolId, username:username });
});

module.exports = router;
