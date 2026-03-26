import express from "express";
import { currentPool } from "./pools.js";

const router = express.Router();

router.get("/leaderboard", (_req, res) => {
  const pool = currentPool();
  const ranked = [...pool.entries]
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({
      rank: i + 1,
      id: e.id,
      user_id: e.user_id,
      score: e.score,
      totalSalary: e.totalSalary,
      players: e.players.map(p => ({ name: p.name, team: p.team, salary: p.salary })),
    }));
  res.json({ ok: true, poolStatus: pool.status, leaderboard: ranked });
});

router.get("/entries", (_req, res) => {
  res.json({ ok: true, entries: currentPool().entries });
});

export default router;