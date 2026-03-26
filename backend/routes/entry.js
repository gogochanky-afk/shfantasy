import express from "express";
import { currentPool } from "./pools.js";

const router = express.Router();
const SALARY_CAP = 10;

router.post("/", (req, res) => {
  const { players, totalSalary } = req.body;
  if (!players || players.length !== 5)
    return res.status(400).json({ ok: false, error: "Need exactly 5 players" });
  if ((totalSalary || 0) > SALARY_CAP)
    return res.status(400).json({ ok: false, error: "Over salary cap ($10)" });
  if (currentPool.status !== "OPEN")
    return res.status(400).json({ ok: false, error: `Pool is ${currentPool.status}` });

  const entry = {
    id: Date.now(),
    players,
    totalSalary: totalSalary || players.reduce((s, p) => s + (p.salary || 0), 0),
    score: 0,
    ts: Date.now(),
  };
  currentPool.entries.push(entry);
  res.json({ ok: true, entryId: entry.id });
});

export default router;
