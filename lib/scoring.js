const { db } = require("./db");

/**
 * Scoring Engine (60s interval)
 * - Updates player stats (demo boxscore)
 * - Detects hot streaks
 * - Recalculates entry scores
 * - Rebuilds leaderboard cache
 * - Updates pool status
 */

const HOT_STREAK_THRESHOLD = 6; // points added in last tick
const HOT_STREAK_MULTIPLIER = 1.5;
const HOT_STREAK_DURATION = 180 * 1000; // 180 seconds
const HOT_STREAK_COOLDOWN = 300 * 1000; // 300 seconds

/**
 * Main scoring tick (called every 60s)
 */
function runScoringTick() {
  const now = new Date();
  console.log(`[Scoring] Tick at ${now.toISOString()}`);

  try {
    // Get all pools that need scoring
    const pools = db
      .prepare(
        `
      SELECT pool_id, lock_time, status 
      FROM pools 
      WHERE status IN ('open', 'live', 'scheduled')
    `
      )
      .all();

    for (const pool of pools) {
      updatePoolStatus(pool, now);

      // Only score live pools
      if (pool.status === "live") {
        updatePlayerStats(pool.pool_id);
        detectHotStreaks(pool.pool_id, now);
        recalculateEntryScores(pool.pool_id, now);
        rebuildLeaderboard(pool.pool_id, now);
      }
    }

    console.log(`[Scoring] Tick complete (${pools.length} pools processed)`);
  } catch (error) {
    console.error("[Scoring] Error in tick:", error);
  }
}

/**
 * Update pool status based on lock_time
 */
function updatePoolStatus(pool, now) {
  const lockTime = new Date(pool.lock_time);
  const timeSinceLock = now - lockTime;

  let newStatus = pool.status;

  if (now < lockTime) {
    newStatus = "scheduled";
  } else if (timeSinceLock < 30 * 60 * 1000) {
    // Live for 30 minutes after lock
    newStatus = "live";
  } else {
    newStatus = "final";
  }

  if (newStatus !== pool.status) {
    db.prepare(
      `
      UPDATE pools 
      SET status = ? 
      WHERE pool_id = ?
    `
    ).run(newStatus, pool.pool_id);

    console.log(
      `[Scoring] Pool ${pool.pool_id} status: ${pool.status} → ${newStatus}`
    );
  }
}

/**
 * Update player stats (demo boxscore)
 */
function updatePlayerStats(poolId) {
  // Get roster for this pool
  const roster = db
    .prepare(
      `
    SELECT data_json 
    FROM roster_snapshots 
    WHERE pool_id = ? 
    ORDER BY captured_at DESC 
    LIMIT 1
  `
    )
    .get(poolId);

  if (!roster) {
    console.log(`[Scoring] No roster found for pool ${poolId}`);
    return;
  }

  const players = JSON.parse(roster.data_json);

  for (const player of players) {
    // Demo: add random points (0-8) each tick
    const pointsAdded = Math.floor(Math.random() * 9);

    db.prepare(
      `
      INSERT INTO player_stats (pool_id, player_id, points, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(pool_id, player_id) 
      DO UPDATE SET 
        points = points + ?,
        updated_at = CURRENT_TIMESTAMP
    `
    ).run(poolId, player.id, pointsAdded, pointsAdded);
  }

  console.log(
    `[Scoring] Updated stats for ${players.length} players in pool ${poolId}`
  );
}

/**
 * Detect hot streaks
 */
function detectHotStreaks(poolId, now) {
  // Get all player stats with points added in last tick
  const stats = db
    .prepare(
      `
    SELECT player_id, points 
    FROM player_stats 
    WHERE pool_id = ?
  `
    )
    .all(poolId);

  // Get previous stats (from 60s ago, approximated by checking updated_at)
  // For demo, we'll use a simple heuristic: if points >= threshold, trigger hot streak

  for (const stat of stats) {
    // Check if player already has an active hot streak
    const activeStreak = db
      .prepare(
        `
      SELECT * 
      FROM events_hot_streak 
      WHERE pool_id = ? 
        AND player_id = ? 
        AND end_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(poolId, stat.player_id, now.toISOString());

    if (activeStreak) {
      // Player already has active streak, skip
      continue;
    }

    // Check cooldown (no streak within last 300s)
    const recentStreak = db
      .prepare(
        `
      SELECT * 
      FROM events_hot_streak 
      WHERE pool_id = ? 
        AND player_id = ? 
        AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(
        poolId,
        stat.player_id,
        new Date(now - HOT_STREAK_COOLDOWN).toISOString()
      );

    if (recentStreak) {
      // Player in cooldown, skip
      continue;
    }

    // Demo: trigger hot streak if player has >= threshold points
    // In production, this would check points_added_in_last_tick
    const pointsAddedLastTick = Math.floor(Math.random() * 10); // Simulate

    if (pointsAddedLastTick >= HOT_STREAK_THRESHOLD) {
      const startAt = now;
      const endAt = new Date(now.getTime() + HOT_STREAK_DURATION);

      db.prepare(
        `
        INSERT INTO events_hot_streak 
        (pool_id, player_id, start_at, end_at, multiplier, trigger_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        poolId,
        stat.player_id,
        startAt.toISOString(),
        endAt.toISOString(),
        HOT_STREAK_MULTIPLIER,
        `+${pointsAddedLastTick} pts in 60s`,
        now.toISOString()
      );

      console.log(
        `[Scoring] 🔥 Hot streak triggered for player ${stat.player_id} in pool ${poolId}`
      );
    }
  }
}

/**
 * Recalculate entry scores
 */
function recalculateEntryScores(poolId, now) {
  const entries = db
    .prepare(
      `
    SELECT entry_id, player_ids 
    FROM entries 
    WHERE pool_id = ?
  `
    )
    .all(poolId);

  for (const entry of entries) {
    const playerIds = JSON.parse(entry.player_ids);
    let pointsTotal = 0;
    let hotStreakBonusTotal = 0;

    for (const playerId of playerIds) {
      // Get player stats
      const stat = db
        .prepare(
          `
        SELECT points 
        FROM player_stats 
        WHERE pool_id = ? AND player_id = ?
      `
        )
        .get(poolId, playerId);

      const basePoints = stat ? stat.points : 0;
      pointsTotal += basePoints;

      // Check if player has active hot streak
      const activeStreak = db
        .prepare(
          `
        SELECT multiplier 
        FROM events_hot_streak 
        WHERE pool_id = ? 
          AND player_id = ? 
          AND start_at <= ? 
          AND end_at > ?
        ORDER BY created_at DESC
        LIMIT 1
      `
        )
        .get(poolId, playerId, now.toISOString(), now.toISOString());

      if (activeStreak) {
        const bonus = basePoints * (activeStreak.multiplier - 1);
        hotStreakBonusTotal += bonus;
      }
    }

    // Update entry_scores
    db.prepare(
      `
      INSERT INTO entry_scores (entry_id, pool_id, points_total, hot_streak_bonus_total, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) 
      DO UPDATE SET 
        points_total = ?,
        hot_streak_bonus_total = ?,
        updated_at = ?
    `
    ).run(
      entry.entry_id,
      poolId,
      pointsTotal,
      hotStreakBonusTotal,
      now.toISOString(),
      pointsTotal,
      hotStreakBonusTotal,
      now.toISOString()
    );
  }

  console.log(
    `[Scoring] Recalculated scores for ${entries.length} entries in pool ${poolId}`
  );
}

/**
 * Rebuild leaderboard cache
 */
function rebuildLeaderboard(poolId, now) {
  const rows = db
    .prepare(
      `
    SELECT 
      e.entry_id,
      e.username,
      e.player_ids,
      e.total_cost,
      e.created_at,
      COALESCE(es.points_total, 0) as points_total,
      COALESCE(es.hot_streak_bonus_total, 0) as hot_streak_bonus_total
    FROM entries e
    LEFT JOIN entry_scores es ON e.entry_id = es.entry_id
    WHERE e.pool_id = ?
    ORDER BY (points_total + hot_streak_bonus_total) DESC, e.created_at ASC
  `
    )
    .all(poolId);

  // Add rank
  const rankedRows = rows.map((row, index) => ({
    rank: index + 1,
    entry_id: row.entry_id,
    username: row.username,
    total_cost: row.total_cost,
    points_total: row.points_total,
    hot_streak_bonus_total: row.hot_streak_bonus_total,
    total_score: row.points_total + row.hot_streak_bonus_total,
    players: JSON.parse(row.player_ids),
    created_at: row.created_at,
  }));

  // Cache leaderboard
  db.prepare(
    `
    INSERT INTO leaderboard_cache (pool_id, rows_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(pool_id) 
    DO UPDATE SET 
      rows_json = ?,
      updated_at = ?
  `
  ).run(
    poolId,
    JSON.stringify(rankedRows),
    now.toISOString(),
    JSON.stringify(rankedRows),
    now.toISOString()
  );

  console.log(
    `[Scoring] Rebuilt leaderboard for pool ${poolId} (${rankedRows.length} entries)`
  );
}

/**
 * Get active hot streaks for a pool
 */
function getActiveHotStreaks(poolId) {
  const now = new Date();
  const streaks = db
    .prepare(
      `
    SELECT player_id, start_at, end_at, multiplier, trigger_note
    FROM events_hot_streak
    WHERE pool_id = ? 
      AND start_at <= ? 
      AND end_at > ?
    ORDER BY created_at DESC
    LIMIT 3
  `
    )
    .all(poolId, now.toISOString(), now.toISOString());

  return streaks.map((s) => ({
    player_id: s.player_id,
    start_at: s.start_at,
    end_at: s.end_at,
    multiplier: s.multiplier,
    trigger_note: s.trigger_note,
    ends_in_seconds: Math.max(
      0,
      Math.floor((new Date(s.end_at) - now) / 1000)
    ),
  }));
}

module.exports = {
  runScoringTick,
  getActiveHotStreaks,
};
