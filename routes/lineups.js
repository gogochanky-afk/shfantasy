const express = require("express");
const router = express.Router();

// In-memory demo store (Cloud Run instance memory)
// For real mode, later we will connect Firestore, but this prevents 404 and unblocks Draft UI now.
const STORE = global.__SHF_LINEUP_STORE__ || new Map();
global.__SHF_LINEUP_STORE__ = STORE;

function nowISO() {
  return new Date().toISOString();
}

function getOrCreateEntry(entryId) {
  if (!STORE.has(entryId)) {
    STORE.set(entryId, {
      entryId,
      poolId: "demo-1",
      players: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  }
  return STORE.get(entryId);
}

/**
 * GET /api/lineup?entryId=xxx
 * Returns: { ok:true, entry:{...}, pool:{...} }
 */
router.get("/", (req, res) => {
  const entryId = String(req.query.entryId || "").trim();
  if (!entryId) {
    return res.status(400).json({ ok: false, error: "entryId is required" });
  }

  const entry = getOrCreateEntry(entryId);

  // Basic pool object used by draft.html
  const pool = {
    id: entry.poolId || "demo-1",
    rosterSize: 5,
    salaryCap: 10,
    lockAt: null,
    locked: false,
  };

  return res.json({ ok: true, entry, pool });
});

/**
 * POST /api/lineup
 * Body: { entryId, players:[...] }
 */
router.post("/", (req, res) => {
  const entryId = String(req.body.entryId || "").trim();
  const players = Array.isArray(req.body.players) ? req.body.players.map(String) : null;

  if (!entryId) return res.status(400).json({ ok: false, error: "entryId is required" });
  if (!players) return res.status(400).json({ ok: false, error: "players array is required" });

  const entry = getOrCreateEntry(entryId);
  entry.players = players;
  entry.updatedAt = nowISO();
  STORE.set(entryId, entry);

  return res.json({ ok: true, entryId, saved: true });
});

module.exports = router;
