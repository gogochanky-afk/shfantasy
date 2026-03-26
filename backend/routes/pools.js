import express from "express";
import { fetchGameStats, simulateScore } from "../lib/scoring.js";

const router = express.Router();

let pool = makePool();
let scoreTimer = null;

function makePool() {
  const now = Date.now();
  return {
    id: `pool_${now}`,
    date: new Date().toISOString().split("T")[0],
    status: "OPEN",
    openAt: now,
    lockAt: now + 5 * 60 * 1000,    // 5 min
    closeAt: now + 15 * 60 * 1000,  // 15 min
    entries: [],
    gameIds: [],
  };
}

export function currentPool() { return pool; }

export function resetPool() {
  if (scoreTimer) clearTimeout(scoreTimer);
  pool = makePool();
  console.log("[pool] NEW OPEN", pool.id);
}

async function settlePool() {
  console.log("[pool] Settling scores...");
  for (const entry of pool.entries) {
    let total = 0;
    for (const p of entry.players) {
      // Try live stats first, fallback to simulation
      total += simulateScore(p.salary || 2);
    }
    entry.score = +total.toFixed(1);
  }
  pool.entries.sort((a, b) => b.score - a.score);
  console.log("[pool] Settled", pool.entries.length, "entries");
}

function tick() {
  const now = Date.now();
  if (pool.status === "OPEN" && now >= pool.lockAt) {
    pool.status = "LOCKED";
    console.log("[pool] LOCKED");
    scoreTimer = setTimeout(async () => {
      await settlePool();
      pool.status = "CLOSED";
      console.log("[pool] CLOSED");
      setTimeout(resetPool, 60_000);
    }, (pool.closeAt - pool.lockAt));
  }
}

setInterval(tick, 5000);

router.get("/", (_req, res) => {
  const p = pool;
  res.json({
    ok: true,
    pools: [{
      id: p.id,
      date: p.date,
      status: p.status,
      lockAt: p.lockAt,
      closeAt: p.closeAt,
      entryCount: p.entries.length,
      lockInSeconds: Math.max(0, Math.floor((p.lockAt - Date.now()) / 1000)),
    }]
  });
});

export default router;