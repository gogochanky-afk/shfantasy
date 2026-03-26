import express from "express";
import { currentPool } from "./pools.js";

const router = express.Router();
const SALARY_CAP = 10;
const LINEUP_SIZE = 5;

router.post("/", (req, res) => {
  const { user_id, players } = req.body;

  if (!players || players.length !== LINEUP_SIZE)
    return res.status(400).json({ ok: false, error: `Need exactly ${LINEUP_SIZE} players` });

  const pool = currentPool();
  if (pool.status !== "OPEN")
    return res.status(400).json({ ok: false, error: `Pool is ${pool.status}` });

  // No duplicates
  const ids = players.map(p => p.playerId);
  if (new Set(ids).size !== ids.length)
    return res.status(400).json({ ok: false, error: "Duplicate players" });

  // Salary cap
  const totalSalary = +players.reduce((s, p) => s + (p.salary || 0), 0).toFixed(2);
  if (totalSalary > SALARY_CAP)
    return res.status(400).json({ ok: false, error: `Over salary cap ($${SALARY_CAP})` });

  const entry = {
    id: Date.now(),
    user_id: user_id || `guest_${Date.now()}`,
    pool_id: pool.id,
    players,
    totalSalary,
    score: 0,
    ts: Date.now(),
  };
  pool.entries.push(entry);
  res.json({ ok: true, entryId: entry.id, totalSalary });
});

export default router;