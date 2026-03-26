import express from "express";
import { currentPool } from "./pools.js";

const router = express.Router();

// Simulate scoring: salary * random factor (replace with real stats later)
function score(entry) {
  if (entry.score > 0) return entry.score;
  return +(entry.players.reduce((s, p) => s + (p.salary || 2) * (8 + Math.random() * 12), 0)).toFixed(1);
}

// GET /api/leaderboard
router.get("/leaderboard", (_req, res) => {
  const ranked = [...currentPool.entries]
    .map((e, i) => ({ rank: i + 1, id: e.id, score: score(e), totalSalary: e.totalSalary, players: e.players.map(p => p.name) }))
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  res.json({ ok: true, poolStatus: currentPool.status, leaderboard: ranked });
});

// GET /api/entries  
router.get("/entries", (_req, res) => {
  res.json({ ok: true, entries: currentPool.entries });
});

export default router;
