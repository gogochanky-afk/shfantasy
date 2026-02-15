const { db } = require("./db");

// Pool lifecycle constants
const OPEN_DURATION = 5 * 60 * 1000; // 5 minutes
const LOCKED_DURATION = 10 * 60 * 1000; // 10 minutes
const SETTLE_WINDOW = LOCKED_DURATION; // Same as LOCKED_DURATION

/**
 * Ensure at least one OPEN pool exists
 */
function ensureOpenPool() {
  const now = new Date();

  // Check if there's an OPEN pool with lock_time > now
  const openPool = db
    .prepare(
      `
    SELECT * FROM pools 
    WHERE status = 'OPEN' 
      AND lock_time > ?
    LIMIT 1
  `
    )
    .get(now.toISOString());

  if (openPool) {
    console.log(`[PoolMaintenance] OPEN pool exists: ${openPool.pool_id}`);
    return;
  }

  // No OPEN pool, create one
  const lockTime = new Date(now.getTime() + OPEN_DURATION);
  const poolId = `blitz-${Date.now()}`;
  const poolName = `Blitz Arena (15m) — ${now.toISOString().slice(0, 16).replace("T", " ")}`;

  db.prepare(
    `
    INSERT INTO pools (
      pool_id, 
      date, 
      sr_game_id, 
      home_team_id, 
      away_team_id, 
      lock_time, 
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    poolId,
    now.toISOString().split("T")[0],
    poolId, // Use pool_id as sr_game_id for demo
    1, // LAL (from seeded teams)
    2, // GSW (from seeded teams)
    lockTime.toISOString(),
    "OPEN"
  );

  console.log(`[PoolMaintenance] Created OPEN pool: ${poolId} (locks at ${lockTime.toISOString()})`);
}

/**
 * Maintain pool lifecycle
 */
function maintainPools() {
  const now = new Date();

  // 1. Transition OPEN pools to LOCKED when lock_time passed
  const openPoolsToLock = db
    .prepare(
      `
    SELECT pool_id, lock_time 
    FROM pools 
    WHERE status = 'OPEN' 
      AND lock_time <= ?
  `
    )
    .all(now.toISOString());

  for (const pool of openPoolsToLock) {
    db.prepare(
      `
      UPDATE pools 
      SET status = 'LOCKED' 
      WHERE pool_id = ?
    `
    ).run(pool.pool_id);

    console.log(`[PoolMaintenance] Pool ${pool.pool_id} → LOCKED`);
  }

  // 2. Transition LOCKED pools to CLOSED when settle window ends
  const lockedPoolsToClose = db
    .prepare(
      `
    SELECT pool_id, lock_time 
    FROM pools 
    WHERE status = 'LOCKED' 
      AND datetime(lock_time, '+' || ? || ' seconds') <= ?
  `
    )
    .all(SETTLE_WINDOW / 1000, now.toISOString());

  for (const pool of lockedPoolsToClose) {
    db.prepare(
      `
      UPDATE pools 
      SET status = 'CLOSED' 
      WHERE pool_id = ?
    `
    ).run(pool.pool_id);

    console.log(`[PoolMaintenance] Pool ${pool.pool_id} → CLOSED`);
  }

  // 3. After closing pools, ensure we have an OPEN pool
  if (lockedPoolsToClose.length > 0) {
    ensureOpenPool();
  }
}

/**
 * Start pool maintenance (call this on server start)
 */
function startPoolMaintenance() {
  console.log("[PoolMaintenance] Starting pool auto-maintenance...");

  // Initial setup
  ensureOpenPool();

  // Run maintenance every 30 seconds
  setInterval(() => {
    try {
      maintainPools();
    } catch (error) {
      console.error("[PoolMaintenance] Error in maintainPools:", error);
    }
  }, 30 * 1000);

  console.log("[PoolMaintenance] Pool auto-maintenance started (30s interval)");
}

module.exports = {
  ensureOpenPool,
  maintainPools,
  startPoolMaintenance,
};
