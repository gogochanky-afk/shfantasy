"use strict";
/**
 * routes/entry.js
 *
 * GET  /api/entry?entryId=...&username=...   → { ok:true, entry }
 * POST /api/entry/save  body: { entryId, username, lineup:[...], salaryUsed }  → { ok:true }
 * GET  /api/my-entries?username=...          → { ok:true, entries:[...] }
 */
const express    = require("express");
const router     = express.Router();
const entryStore = require("../lib/entryStore");

// GET /api/entry?entryId=...&username=...
router.get("/", async function(req, res) {
  try {
    var entryId  = String(req.query.entryId  || "").trim();
    var username = String(req.query.username || "").trim();
    if (!entryId) return res.status(400).json({ ok:false, error:"entryId required" });
    var entry = await entryStore.getEntry(entryId, username || undefined);
    if (!entry) return res.status(404).json({ ok:false, error:"Entry not found" });
    res.json({ ok:true, entry:entry });
  } catch (e) {
    console.error("[entry GET] Error:", e.message);
    res.status(500).json({ ok:false, error:"Internal server error" });
  }
});

// POST /api/entry/save  body: { entryId, username, lineup, salaryUsed }
router.post("/save", async function(req, res) {
  try {
    var entryId    = String(req.body.entryId  || "").trim();
    var username   = String(req.body.username || "").trim();
    var lineup     = Array.isArray(req.body.lineup) ? req.body.lineup : null;
    var salaryUsed = Number(req.body.salaryUsed) || 0;

    if (!entryId)  return res.status(400).json({ ok:false, error:"entryId required" });
    if (!username) return res.status(400).json({ ok:false, error:"username required" });
    if (!lineup)   return res.status(400).json({ ok:false, error:"lineup array required" });
    if (lineup.length === 0) return res.status(400).json({ ok:false, error:"lineup must not be empty" });

    // Sanitise lineup items
    var clean = lineup.map(function(p) {
      return {
        id:       String(p.id       || ""),
        name:     String(p.name     || ""),
        team:     String(p.team     || ""),
        position: String(p.position || ""),
        cost:     Number(p.cost)    || 0,
      };
    });

    var entry = await entryStore.saveLineup(entryId, username, clean, salaryUsed);
    res.json({ ok:true, entryId:entry.entryId, updatedAt:entry.updatedAt });
  } catch (e) {
    console.error("[entry/save] Error:", e.message);
    if (e.message && e.message.indexOf("not found") !== -1) {
      return res.status(404).json({ ok:false, error:e.message });
    }
    res.status(500).json({ ok:false, error:"Internal server error" });
  }
});

// GET /api/my-entries?username=...
router.get("/my-entries", async function(req, res) {
  try {
    var username = String(req.query.username || "").trim();
    if (!username) return res.status(400).json({ ok:false, error:"username required" });
    var entries = await entryStore.getEntriesByUsername(username);
    // Sort newest first
    entries.sort(function(a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    res.json({ ok:true, username:username, entries:entries });
  } catch (e) {
    console.error("[my-entries] Error:", e.message);
    res.status(500).json({ ok:false, error:"Internal server error" });
  }
});

module.exports = router;
