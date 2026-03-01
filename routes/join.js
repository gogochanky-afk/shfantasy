"use strict";
/**
 * routes/join.js
 * POST /api/join  body: { username, poolId }
 * Creates a new entry in entryStore and returns { ok:true, entryId, poolId, username }.
 */
const express       = require("express");
const router        = express.Router();
const crypto        = require("crypto");
const entryStore    = require("../lib/entryStore");
const snapshotStore = require("../lib/snapshotStore");

router.post("/", async function(req, res) {
  try {
    var username = String(req.body.username || "").trim();
    var poolId   = String(req.body.poolId   || "").trim();

    if (!username)             return res.status(400).json({ ok:false, error:"username required" });
    if (username.length < 2)   return res.status(400).json({ ok:false, error:"username must be 2-16 chars" });
    if (username.length > 16)  return res.status(400).json({ ok:false, error:"username must be 2-16 chars" });
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) return res.status(400).json({ ok:false, error:"username: letters/numbers/_/- only" });
    if (!poolId)               return res.status(400).json({ ok:false, error:"poolId required" });

    var { pools } = snapshotStore.getPools();
    var pool = pools.find(function(p){ return p.id === poolId; });
    if (!pool) return res.status(404).json({ ok:false, error:"Pool not found: " + poolId });

    if (pool.lockAt) {
      var lockTime = new Date(pool.lockAt).getTime();
      if (!isNaN(lockTime) && Date.now() >= lockTime) {
        return res.status(409).json({ ok:false, error:"Pool is locked", locked:true, lockAt:pool.lockAt });
      }
    }

    var entryId = "e-" + crypto.randomBytes(6).toString("hex");
    var entry   = await entryStore.createEntry(entryId, username, poolId);

    res.json({
      ok:        true,
      entryId:   entry.entryId,
      poolId:    entry.poolId,
      username:  entry.username,
      createdAt: entry.createdAt,
    });
  } catch (e) {
    console.error("[join] Error:", e.message);
    res.status(500).json({ ok:false, error:"Internal server error" });
  }
});

module.exports = router;
