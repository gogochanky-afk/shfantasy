const express = require("express");
const path = require("path");
const { getOrCreateTeam, upsertPool, getTodayTomorrowPools, saveEntry, getAllEntries } = require("./lib/db");
const { getOrGenerateRoster } = require("./lib/roster");
const { startPoolMaintenance } = require("./lib/poolMaintenance");

const app = express();
app.use(express.json());

// Cloud Run uses PORT env
const PORT = process.env.PORT || 8080;

// DATA_MODE: "hybrid" (default), "demo", "live"
const DATA_MODE = process.env.DATA_MODE || "hybrid";

console.log(`Starting SHFantasy server...`);
console.log(`DATA_MODE=${DATA_MODE}`);
console.log(`TZ=${process.env.TZ || "UTC"}`);

/**
 * Seed demo pools if DB is empty
 */
function seedDemoPools() {
  const pools = getTodayTomorrowPools();
  if (pools.length > 0) {
    console.log(`[Seed] ${pools.length} pools already exist, skipping seed`);
    return;
  }

  console.log("[Seed] No pools found, seeding demo pools...");

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const lalId = getOrCreateTeam("LAL", "Los Angeles Lakers");
  const gswId = getOrCreateTeam("GSW", "Golden State Warriors");
  const milId = getOrCreateTeam("MIL", "Milwaukee Bucks");
  const bosId = getOrCreateTeam("BOS", "Boston Celtics");

  // Demo pools lock 10 minutes after server start (for testing)
  const lockTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const demoPools = [
    {
      pool_id: `${today}_demo-game-1`,
      date: today,
      sr_game_id: "demo-game-1",
      home_team_id: lalId,
      away_team_id: gswId,
      lock_time: lockTime,
      status: "open",
    },
    {
      pool_id: `${today}_demo-game-2`,
      date: today,
      sr_game_id: "demo-game-2",
      home_team_id: milId,
      away_team_id: bosId,
      lock_time: lockTime,
      status: "open",
    },
    {
      pool_id: `${tomorrow}_demo-game-3`,
      date: tomorrow,
      sr_game_id: "demo-game-3",
      home_team_id: gswId,
      away_team_id: milId,
      lock_time: lockTime,
      status: "open",
    },
  ];

  demoPools.forEach((pool) => {
    upsertPool(pool);
    console.log(`[Seed] Created pool: ${pool.pool_id}`);
  });

  console.log(`[Seed] Seeded ${demoPools.length} demo pools`);
}

// Seed demo pools on startup
seedDemoPools();

// Pool auto-maintenance will handle pool creation

/**
 * API health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy",
    data_mode: DATA_MODE,
    ts: new Date().toISOString(),
  });
});

/**
 * API: Get available pools
 */
app.get("/api/pools", (req, res) => {
  const { db } = require("./lib/db");
  
  try {
    // Get all pools, ordered by status (OPEN first, then LOCKED, then CLOSED)
    // Limit to 10 most recent pools
    const pools = db
      .prepare(
        `
      SELECT 
        p.pool_id,
        p.date,
        p.sr_game_id,
        p.lock_time,
        p.status,
        h.abbr as home_abbr,
        h.name as home_name,
        a.abbr as away_abbr,
        a.name as away_name
      FROM pools p
      LEFT JOIN nba_teams h ON p.home_team_id = h.id
      LEFT JOIN nba_teams a ON p.away_team_id = a.id
      ORDER BY 
        CASE p.status
          WHEN 'OPEN' THEN 1
          WHEN 'LOCKED' THEN 2
          WHEN 'CLOSED' THEN 3
          ELSE 4
        END,
        p.lock_time DESC
      LIMIT 10
    `
      )
      .all();

    if (pools.length === 0) {
      console.log("[API] No pools in DB (should not happen with auto-maintenance)");
      return res.json({
        ok: true,
        data_mode: DATA_MODE,
        pools: [],
        updated_at: new Date().toISOString(),
      });
    }

    res.json({
      ok: true,
      data_mode: DATA_MODE,
      pools: pools.map((p) => ({
        pool_id: p.pool_id,
        date: p.date,
        home: { abbr: p.home_abbr, name: p.home_name },
        away: { abbr: p.away_abbr, name: p.away_name },
        lock_time: p.lock_time,
        status: p.status,
      })),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Error fetching pools:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch pools",
      data_mode: "error",
    });
  }
});

/**
 * API: Get players for a pool (alias for /api/roster)
 */
app.get("/api/pools/:poolId/players", (req, res) => {
  const { poolId } = req.params;

  try {
    // Get pool info
    const pools = getTodayTomorrowPools();
    const pool = pools.find((p) => p.pool_id === poolId);

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Get roster
    const roster = getOrGenerateRoster(poolId, pool.home.abbr, pool.away.abbr);

    res.json({
      ok: true,
      pool_id: poolId,
      players: roster.players,
      updated_at: roster.updated_at,
    });
  } catch (error) {
    console.error("[API] Error fetching players:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch players",
    });
  }
});

/**
 * API: Get roster for a pool
 */
app.get("/api/roster", (req, res) => {
  const { pool_id } = req.query;

  if (!pool_id) {
    return res.status(400).json({
      ok: false,
      error: "pool_id is required",
    });
  }

  try {
    // Get pool info
    const pools = getTodayTomorrowPools();
    const pool = pools.find((p) => p.pool_id === pool_id);

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Get or generate roster
    const roster = getOrGenerateRoster(pool_id, pool.home.abbr, pool.away.abbr);

    res.json({
      ok: true,
      ...roster,
    });
  } catch (error) {
    console.error("[API] Error fetching roster:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch roster",
    });
  }
});

/**
 * API: Submit entry
 */
app.post("/api/entries", (req, res) => {
  const { pool_id, player_ids } = req.body;

  const { db } = require("./lib/db");
  
  try {
    // Validation: pool exists
    const pool = db
      .prepare(
        `
      SELECT 
        p.pool_id,
        p.status,
        p.lock_time,
        h.abbr as home_abbr,
        a.abbr as away_abbr
      FROM pools p
      LEFT JOIN nba_teams h ON p.home_team_id = h.id
      LEFT JOIN nba_teams a ON p.away_team_id = a.id
      WHERE p.pool_id = ?
    `
      )
      .get(pool_id);

    if (!pool) {
      return res.status(400).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Validation: pool status must be OPEN
    if (pool.status !== "OPEN") {
      return res.status(409).json({
        ok: false,
        error: "POOL_LOCKED",
        lock_at: pool.lock_time,
      });
    }

    // Validation: lock_time not passed
    const now = new Date();
    const lockTime = new Date(pool.lock_time);
    if (now > lockTime) {
      return res.status(409).json({
        ok: false,
        error: "POOL_LOCKED",
        lock_at: pool.lock_time,
      });
    }

    // Validation: exactly 5 players
    if (!player_ids || player_ids.length !== 5) {
      return res.status(400).json({
        ok: false,
        error: "Must select exactly 5 players",
      });
    }

    // Get roster
    const roster = getOrGenerateRoster(pool_id, pool.home_abbr, pool.away_abbr);
    const players = roster.players;

    // Validation: all players exist
    const selectedPlayers = player_ids.map((pid) =>
      players.find((p) => p.id === pid)
    );

    if (selectedPlayers.some((p) => !p)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid player ID",
      });
    }

    // Validation: total cost <= 10
    const totalCost = selectedPlayers.reduce((sum, p) => sum + p.price, 0);
    if (totalCost > 10) {
      return res.status(400).json({
        ok: false,
        error: `Total cost ${totalCost} exceeds salary cap of 10`,
      });
    }

    // Create entry
    const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry = {
      entry_id: entryId,
      pool_id,
      player_ids,
      total_cost: totalCost,
      status: "active",
      score: 0,
      rank: null,
    };

    saveEntry(entry);

    res.json({
      ok: true,
      entry_id: entryId,
      entry,
    });
  } catch (error) {
    console.error("[API] Error creating entry:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to create entry",
    });
  }
});

/**
 * API: Get user entries
 */
app.get("/api/entries", (req, res) => {
  const { db } = require("./lib/db");
  
  try {
    const entries = getAllEntries();

    // Enrich entries with pool, player info, and live scores
    const enrichedEntries = entries.map((entry) => {
      const pools = getTodayTomorrowPools();
      const pool = pools.find((p) => p.pool_id === entry.pool_id);

      if (!pool) {
        return {
          ...entry,
          pool_name: "Unknown Pool",
          players: [],
          points_total: 0,
          hot_streak_bonus_total: 0,
          updated_at: null,
        };
      }

      const roster = getOrGenerateRoster(entry.pool_id, pool.home.abbr, pool.away.abbr);
      const players = entry.player_ids.map((pid) =>
        roster.players.find((p) => p.id === pid)
      ).filter(Boolean);

      // Get live scores from entry_scores
      const liveScore = db
        .prepare("SELECT points_total, hot_streak_bonus_total, updated_at FROM entry_scores WHERE entry_id = ?")
        .get(entry.entry_id);

      return {
        id: entry.entry_id,
        pool_id: entry.pool_id,
        pool_name: `${pool.home.abbr} vs ${pool.away.abbr}`,
        players,
        total_cost: entry.total_cost,
        status: entry.status,
        points_total: liveScore?.points_total || 0,
        hot_streak_bonus_total: liveScore?.hot_streak_bonus_total || 0,
        total_score: (liveScore?.points_total || 0) + (liveScore?.hot_streak_bonus_total || 0),
        updated_at: liveScore?.updated_at || entry.created_at,
        created_at: entry.created_at,
      };
    });

    res.json({
      ok: true,
      entries: enrichedEntries,
      data_mode: DATA_MODE,
    });
  } catch (error) {
    console.error("[API] Error fetching entries:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch entries",
    });
  }
});

/**
 * API: Get game status for a pool
 */
app.get("/api/games/status", (req, res) => {
  try {
    let { poolId } = req.query;

    // If no poolId provided, use first available pool
    if (!poolId) {
      const pools = getTodayTomorrowPools();
      if (pools.length === 0) {
        return res.json({
          ok: true,
          status: "unknown",
          lock_at: null,
          updated_at: new Date().toISOString(),
          period: null,
          clock: null,
        });
      }
      poolId = pools[0].pool_id;
    }

    // Get pool info
    const pools = getTodayTomorrowPools();
    const pool = pools.find((p) => p.pool_id === poolId);

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Demo period/clock (placeholder)
    const now = new Date();
    const lockTime = new Date(pool.lock_time);
    const timeSinceLock = now - lockTime;

    let period = null;
    let clock = null;

    if (pool.status === "live") {
      // Demo: simulate quarters
      const minutesSinceLock = Math.floor(timeSinceLock / 60000);
      period = Math.min(Math.floor(minutesSinceLock / 12) + 1, 4);
      const minutesInQuarter = minutesSinceLock % 12;
      clock = `${11 - minutesInQuarter}:${String(60 - ((timeSinceLock / 1000) % 60)).padStart(2, "0").slice(0, 2)}`;
    }

    res.json({
      ok: true,
      status: pool.status,
      lock_at: pool.lock_time,
      updated_at: new Date().toISOString(),
      period,
      clock,
    });
  } catch (error) {
    console.error("[API] Error fetching game status:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch game status",
    });
  }
});

/**
 * API: Get leaderboard for a pool
 */
app.get("/api/leaderboard", (req, res) => {
  const { db } = require("./lib/db");
  
  try {
    let { pool_id } = req.query;

    // If no pool_id provided, use first OPEN or LOCKED pool
    if (!pool_id) {
      const pool = db
        .prepare(
          `
        SELECT pool_id 
        FROM pools 
        WHERE status IN ('OPEN', 'LOCKED') 
        ORDER BY 
          CASE status
            WHEN 'OPEN' THEN 1
            WHEN 'LOCKED' THEN 2
          END,
          lock_time DESC
        LIMIT 1
      `
        )
        .get();

      if (!pool) {
        return res.json({
          ok: true,
          pool_id: null,
          data_mode: DATA_MODE,
          updated_at: new Date().toISOString(),
          rows: [],
        });
      }
      pool_id = pool.pool_id;
    }

    // Get pool status
    const pool = db
      .prepare("SELECT status, lock_time FROM pools WHERE pool_id = ?")
      .get(pool_id);

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Get all entries for this pool
    const entries = db
      .prepare(
        `
      SELECT 
        entry_id,
        username,
        player_ids,
        total_cost,
        created_at
      FROM entries
      WHERE pool_id = ?
    `
      )
      .all(pool_id);

    // Generate deterministic demo scores
    // For LOCKED pools: scores change every minute but are consistent per entry
    const now = new Date();
    const minuteTick = Math.floor(now.getTime() / (60 * 1000)); // Changes every minute

    const rows = entries.map((entry, index) => {
      let score = 0;

      if (pool.status === "LOCKED") {
        // Demo: base score + minute_tick * small_delta
        // Use entry_id as seed for consistency
        const seed = parseInt(entry.entry_id.split("-")[1] || "0", 10);
        const baseScore = (seed % 50) + 20; // 20-70 base
        const delta = ((seed + minuteTick) % 10) - 5; // -5 to +5 per minute
        score = baseScore + delta * 0.5;
      }

      return {
        rank: 0, // Will be set after sorting
        entry_id: entry.entry_id,
        username: entry.username,
        total_cost: entry.total_cost,
        score: Math.max(0, score), // Never negative
        players: JSON.parse(entry.player_ids),
        created_at: entry.created_at,
      };
    });

    // Sort by score DESC, then created_at ASC
    rows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Assign ranks
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    res.json({
      ok: true,
      pool_id,
      data_mode: DATA_MODE,
      updated_at: now.toISOString(),
      rows,
    });
  } catch (error) {
    console.error("[API] Error fetching leaderboard:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch leaderboard",
    });
  }
});

/**
 * Serve React frontend (static files from frontend/dist)
 */
const frontendPath = path.join(__dirname, "frontend", "dist");
app.use(express.static(frontendPath));

/**
 * SPA fallback: serve index.html for all non-API routes
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SHFantasy listening on ${PORT}`);
  console.log(`Frontend path: ${frontendPath}`);

  // Start pool auto-maintenance
  startPoolMaintenance();
});
