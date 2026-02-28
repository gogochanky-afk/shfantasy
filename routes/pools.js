// routes/pools.js
// GET /api/pools — today + tomorrow pools
//
// Priority:
// 1) LIVE: try Sportradar (may 429)
// 2) If LIVE fails: SNAPSHOT fallback (local file)
// 3) If snapshot missing/broken: DEMO fallback
//
// Notes:
// - This file MUST NOT require db / better-sqlite3
// - Works on Cloud Run with PORT=8080

"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const { getOrFetch } = require("../lib/cache");

const CACHE_TTL_S = 120; // seconds
const CACHE_KEY = "pools:live";

// ---------- DEMO ----------
const DEMO_POOLS_BASE = [
  {
    id: "demo-today",
    title: "Demo Pool · Today",
    homeTeam: { abbr: "LAL", name: "Los Angeles Lakers" },
    awayTeam: { abbr: "GSW", name: "Golden State Warriors" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "today",
  },
  {
    id: "demo-tomorrow",
    title: "Demo Pool · Tomorrow",
    homeTeam: { abbr: "BOS", name: "Boston Celtics" },
    awayTeam: { abbr: "MIA", name: "Miami Heat" },
    rosterSize: 5,
    salaryCap: 10,
    status: "open",
    day: "tomorrow",
  },
];

function getDeterministicLockAt() {
  return new Date(Math.floor(Date.now() / 60000) * 60000 + 60000).toISOString();
}

function getDemoPools() {
  const lockAt = getDeterministicLockAt();
  return DEMO_POOLS_BASE.map((p) => Object.assign({}, p, { lockAt }));
}

// ---------- SNAPSHOT ----------
function loadSnapshotPools() {
  // /app is typical in Cloud Run container
  const snapshotPath = path.join(__dirname, "..", "data", "snapshot_pools.json");
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const parsed = JSON.parse(raw);

  const pools = Array.isArray(parsed.pools) ? parsed.pools : [];
  const updatedAt = parsed.updatedAt || new Date().toISOString();

  if (pools.length === 0) {
    throw new Error("snapshot_pools.json has no pools");
  }

  // Ensure lockAt exists for all pools
  const lockAt = getDeterministicLockAt();
  const normalized = pools.map((p) => Object.assign({ lockAt }, p));

  return { updatedAt, pools: normalized };
}

// ---------- LIVE helpers ----------
function getTodayTomorrow() {
  const now = new Date();
  // Tokyo time logic (as you used previously)
  const tokyoOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const tokyoTime = new Date(now.getTime() + (tokyoOffset + localOffset) * 60000);

  const fmt = (d) => d.toISOString().split("T")[0];
  const tomorrow = new Date(tokyoTime);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return { today: fmt(tokyoTime), tomorrow: fmt(tomorrow) };
}

function gameToPool(game, day) {
  const lockAt = game.scheduled
    ? new Date(new Date(game.scheduled).getTime() - 5 * 60000).toISOString()
    : getDeterministicLockAt();

  return {
    id: "sr-" + game.sr_game_id,
    title:
      (game.away_team.alias || game.away_team.name) +
      " @ " +
      (game.home_team.alias || game.home_team.name),
    homeTeam: { abbr: game.home_team.alias, name: game.home_team.name },
    awayTeam: { abbr: game.away_team.alias, name: game.away_team.name },
    srGameId: game.sr_game_id,
    rosterSize: 5,
    salaryCap: 10,
    lockAt,
    status: game.status === "closed" ? "closed" : "open",
    day,
  };
}

// ---------- Route ----------
router.get("/", async function (req, res) {
  const DATA_MODE = (process.env.DATA_MODE || "DEMO").toUpperCase();
  const now = new Date().toISOString();

  // If not LIVE => always DEMO (for safety)
  if (DATA_MODE !== "LIVE") {
    return res.json({
      ok: true,
      dataMode: "DEMO",
      updatedAt: now,
      pools: getDemoPools(),
    });
  }

  // LIVE mode: try Sportradar, but if quota is blown => fallback snapshot
  try {
    const { fetchGames } = require("../lib/sportradar");

    const cacheResult = await getOrFetch(CACHE_KEY, CACHE_TTL_S, async function () {
      const { today, tomorrow } = getTodayTomorrow();
      const todayGames = await fetchGames(today);
      const tomorrowGames = await fetchGames(tomorrow);

      const pools = todayGames
        .map((g) => gameToPool(g, "today"))
        .concat(tomorrowGames.map((g) => gameToPool(g, "tomorrow")));

      if (pools.length === 0) {
        throw new Error("no games returned from Sportradar");
      }
      return pools;
    });

    return res.json({
      ok: true,
      dataMode: cacheResult.stale ? "LIVE_STALE" : "LIVE",
      updatedAt: cacheResult.cachedAt,
      pools: cacheResult.value,
    });
  } catch (err) {
    // Any LIVE error (429/timeout/etc) -> snapshot fallback
    console.warn("[pools] LIVE failed, using SNAPSHOT fallback:", err && err.message ? err.message : err);

    try {
      const snap = loadSnapshotPools();
      return res.json({
        ok: true,
        dataMode: "SNAPSHOT_FALLBACK",
        updatedAt: snap.updatedAt,
        pools: snap.pools,
        note: "sportradar unavailable (likely quota/rate-limit) — serving snapshot pools",
      });
    } catch (snapErr) {
      console.error("[pools] SNAPSHOT fallback failed, using DEMO:", snapErr && snapErr.message ? snapErr.message : snapErr);
      return res.json({
        ok: true,
        dataMode: "DEMO_FALLBACK",
        updatedAt: now,
        pools: getDemoPools(),
        note: "snapshot missing/broken — serving demo pools",
      });
    }
  }
});

module.exports = router;
