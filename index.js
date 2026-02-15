const express = require("express");
const path = require("path");
const { fetchTodayTomorrowGames } = require("./lib/sportradar");
const { getOrCreateTeam, upsertPool, getTodayTomorrowPools, saveEntry, getAllEntries } = require("./lib/db");
const { getOrGenerateRoster } = require("./lib/roster");

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

  const demoPools = [
    {
      pool_id: `${today}_demo-game-1`,
      date: today,
      sr_game_id: "demo-game-1",
      home_team_id: lalId,
      away_team_id: gswId,
      lock_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: "open",
    },
    {
      pool_id: `${today}_demo-game-2`,
      date: today,
      sr_game_id: "demo-game-2",
      home_team_id: milId,
      away_team_id: bosId,
      lock_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      status: "open",
    },
    {
      pool_id: `${tomorrow}_demo-game-3`,
      date: tomorrow,
      sr_game_id: "demo-game-3",
      home_team_id: gswId,
      away_team_id: milId,
      lock_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
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

/**
 * Sync pools from Sportradar (called on startup and periodically)
 */
async function syncPools() {
  if (DATA_MODE === "demo") {
    console.log("[Sync] Skipping pool sync in demo mode");
    return;
  }

  try {
    console.log("[Sync] Fetching games from Sportradar...");
    const games = await fetchTodayTomorrowGames();

    if (games.length === 0) {
      console.log("[Sync] No games found, using existing pools");
      return;
    }

    for (const game of games) {
      const homeTeamId = getOrCreateTeam(
        game.home_team.alias,
        game.home_team.name,
        game.home_team.id
      );
      const awayTeamId = getOrCreateTeam(
        game.away_team.alias,
        game.away_team.name,
        game.away_team.id
      );

      const date = game.scheduled.split("T")[0];
      const poolId = `${date}_${game.sr_game_id}`;

      upsertPool({
        pool_id: poolId,
        date,
        sr_game_id: game.sr_game_id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        lock_time: game.scheduled,
        status: game.status === "scheduled" ? "open" : "locked",
      });

      console.log(`[Sync] Upserted pool: ${poolId}`);
    }

    console.log(`[Sync] Successfully synced ${games.length} pools`);
  } catch (error) {
    console.error("[Sync] Error syncing pools:", error.message);
  }
}

// Sync pools on startup
syncPools();

// Sync pools every 30 minutes
setInterval(syncPools, 30 * 60 * 1000);

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
  try {
    const pools = getTodayTomorrowPools();

    if (pools.length === 0) {
      console.log("[API] No pools in DB, falling back to demo");
      return res.json({
        ok: true,
        data_mode: DATA_MODE === "demo" ? "demo" : "demo_fallback",
        pools: [{
          pool_id: "demo-pool-1",
          date: new Date().toISOString().split("T")[0],
          home: { abbr: "LAL", name: "Los Angeles Lakers" },
          away: { abbr: "GSW", name: "Golden State Warriors" },
          lock_time: new Date().toISOString(),
          status: "open",
        }],
        updated_at: new Date().toISOString(),
      });
    }

    res.json({
      ok: true,
      data_mode: DATA_MODE,
      pools: pools.map((p) => ({
        pool_id: p.pool_id,
        date: p.date,
        home: { abbr: p.home.abbr, name: p.home.name },
        away: { abbr: p.away.abbr, name: p.away.name },
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

  try {
    // Validation: pool exists
    const pools = getTodayTomorrowPools();
    const pool = pools.find((p) => p.pool_id === pool_id);

    if (!pool) {
      return res.status(400).json({
        ok: false,
        error: "Pool not found",
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
    const roster = getOrGenerateRoster(pool_id, pool.home.abbr, pool.away.abbr);
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
  try {
    const entries = getAllEntries();

    // Enrich entries with pool and player info
    const enrichedEntries = entries.map((entry) => {
      const pools = getTodayTomorrowPools();
      const pool = pools.find((p) => p.pool_id === entry.pool_id);

      if (!pool) {
        return {
          ...entry,
          pool_name: "Unknown Pool",
          players: [],
        };
      }

      const roster = getOrGenerateRoster(entry.pool_id, pool.home.abbr, pool.away.abbr);
      const players = entry.player_ids.map((pid) =>
        roster.players.find((p) => p.id === pid)
      ).filter(Boolean);

      return {
        id: entry.entry_id,
        pool_id: entry.pool_id,
        pool_name: `${pool.home.abbr} vs ${pool.away.abbr}`,
        players,
        total_cost: entry.total_cost,
        status: entry.status,
        score: entry.score,
        rank: entry.rank,
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
 * API: Get leaderboard for a pool
 */
app.get("/api/leaderboard", (req, res) => {
  try {
    let { pool_id } = req.query;

    // If no pool_id provided, use first available pool
    if (!pool_id) {
      const pools = getTodayTomorrowPools();
      if (pools.length === 0) {
        return res.json({
          ok: true,
          pool_id: null,
          data_mode: DATA_MODE,
          updated_at: new Date().toISOString(),
          rows: [],
        });
      }
      pool_id = pools[0].pool_id;
    }

    // Get all entries for this pool
    const allEntries = getAllEntries();
    const poolEntries = allEntries.filter((e) => e.pool_id === pool_id);

    // Get pool info for roster
    const pools = getTodayTomorrowPools();
    const pool = pools.find((p) => p.pool_id === pool_id);

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Pool not found",
      });
    }

    // Get roster for player names
    const roster = getOrGenerateRoster(pool_id, pool.home.abbr, pool.away.abbr);

    // Build leaderboard rows
    const rows = poolEntries.map((entry) => {
      const players = entry.player_ids.map((pid) => {
        const player = roster.players.find((p) => p.id === pid);
        return player ? player.name : "Unknown";
      });

      // Calculate projected_score (demo: sum of player prices * 10)
      const projectedScore = entry.total_cost * 10 + Math.random() * 20;

      return {
        entry_id: entry.entry_id,
        username: `demo_user_${entry.entry_id.split("-")[1]}`,
        total_cost: entry.total_cost,
        projected_score: Math.round(projectedScore * 10) / 10,
        players,
        created_at: entry.created_at,
      };
    });

    // Sort by projected_score desc, then created_at asc
    rows.sort((a, b) => {
      if (b.projected_score !== a.projected_score) {
        return b.projected_score - a.projected_score;
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Add rank
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    res.json({
      ok: true,
      pool_id,
      data_mode: DATA_MODE,
      updated_at: new Date().toISOString(),
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
});
