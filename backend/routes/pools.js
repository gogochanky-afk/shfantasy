import express from "express";

const router = express.Router();

// Singleton pool — resets every 15 min
function makePool() {
  const now = Date.now();
  return {
    id: `pool_${now}`,
    status: "OPEN",
    openAt: now,
    lockAt: now + 5 * 60 * 1000,
    closeAt: now + 15 * 60 * 1000,
    entries: [],
  };
}

export let currentPool = makePool();

export function tickPool() {
  const now = Date.now();
  if (currentPool.status === "OPEN" && now >= currentPool.lockAt) {
    currentPool.status = "LOCKED";
    console.log("[pool] LOCKED");
  }
  if (currentPool.status === "LOCKED" && now >= currentPool.closeAt) {
    currentPool.status = "CLOSED";
    console.log("[pool] CLOSED → resetting in 60s");
    setTimeout(() => { currentPool = makePool(); console.log("[pool] OPEN"); }, 60_000);
  }
}

setInterval(tickPool, 5000);

router.get("/", (_req, res) => {
  const p = currentPool;
  res.json({
    ok: true,
    pools: [{
      id: p.id,
      status: p.status,
      lockAt: p.lockAt,
      closeAt: p.closeAt,
      entryCount: p.entries.length,
      lockInSeconds: Math.max(0, Math.floor((p.lockAt - Date.now()) / 1000)),
    }]
  });
});

export default router;
