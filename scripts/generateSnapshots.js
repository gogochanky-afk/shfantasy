#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side snapshot generator — NEVER called by user traffic.
 * Calls Sportradar NBA API to fetch today+tomorrow scheduled games and
 * team rosters, then writes:
 *   data/snapshots/pools.snapshot.json
 *   data/snapshots/players.<poolId>.json  (one per game)
 *   data/snapshots/players.fallback.json  (all players combined)
 *
 * Usage:
 *   SPORTRADAR_API_KEY=xxx node scripts/generateSnapshots.js
 *   or via admin endpoint: POST /api/admin/generate-snapshots
 *
 * Fallback policy:
 *   If Sportradar fails (quota / rate-limit / network), existing snapshot
 *   files are preserved and an error is logged. Runtime is NEVER broken.
 *   Zero sqlite / better-sqlite3 / DB dependencies.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY      = process.env.SPORTRADAR_API_KEY || "";
const ACCESS_LEVEL = (process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial").toLowerCase();
const BASE_URL     = "https://api.sportradar.com/nba/" + ACCESS_LEVEL + "/v8/en";
const SNAP_DIR     = path.join(__dirname, "..", "data", "snapshots");
const LOCK_OFFSET_MS = 10 * 60 * 1000; // lock 10 min before tip-off
const MAX_POOLS    = 4;  // max pools to generate (today + tomorrow combined)
const MAX_PER_TEAM = 9;  // max players to keep per team

// ── Cost tiers ────────────────────────────────────────────────────────────────
// Tier 4 ($4): franchise stars
const TIER4 = new Set([
  "lebron james","stephen curry","kevin durant","giannis antetokounmpo",
  "luka doncic","nikola jokic","joel embiid","jayson tatum","damian lillard",
  "devin booker","trae young","ja morant","zion williamson","anthony davis",
  "kawhi leonard","shai gilgeous-alexander","victor wembanyama",
  "cade cunningham","jalen brunson","anthony edwards","jaylen brown",
]);
// Tier 3 ($3): all-stars / near-stars
const TIER3 = new Set([
  "paul george","jimmy butler","bam adebayo","donovan mitchell",
  "tyrese haliburton","pascal siakam","darius garland","lauri markkanen",
  "julius randle","karl-anthony towns","rudy gobert","de'aaron fox",
  "brandon ingram","zach lavine","kyrie irving","james harden",
  "klay thompson","draymond green","andrew wiggins","austin reaves",
  "d'angelo russell","mikal bridges","jalen green","scottie barnes",
  "evan mobley","jarrett allen","desmond bane","jaren jackson jr.",
  "alperen sengun","max christie","rui hachimura","cam thomas",
]);
// Tier 2 ($2): rotation starters
const TIER2 = new Set([
  "jonathan kuminga","moses moody","kevon looney","gary payton ii",
  "donte divincenzo","kyle anderson","brandin podziemski","pat spencer",
  "jarred vanderbilt","taurean prince","jaxson hayes","naz reid",
  "monte morris","shake milton","tobias harris","kelly oubre jr.",
  "nic claxton","cam johnson","royce o'neale","dorian finney-smith",
  "spencer dinwiddie","seth curry","tim hardaway jr.","pat connaughton",
  "khris middleton","brook lopez","bobby portis","malik beasley",
]);
// All others default to Tier 1 ($1)

// ── Helpers ───────────────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith("https") ? https : http;
    var req = mod.get(url, { headers: { "Accept": "application/json" } }, function(res) {
      var body = "";
      res.on("data", function(c) { body += c; });
      res.on("end", function() {
        if (res.statusCode === 429) {
          return reject(Object.assign(new Error("RATE_LIMITED"), { code: 429 }));
        }
        if (res.statusCode !== 200) {
          return reject(new Error("HTTP " + res.statusCode + " for " + url));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSON parse error: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, function() { req.destroy(new Error("TIMEOUT")); });
  });
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function writeJSON(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
}

/** Format Date as YYYY/MM/DD for Sportradar schedule endpoint */
function dateStr(d) {
  var y  = d.getUTCFullYear();
  var m  = String(d.getUTCMonth() + 1).padStart(2, "0");
  var dd = String(d.getUTCDate()).padStart(2, "0");
  return y + "/" + m + "/" + dd;
}

/** Format Date as YYYYMMDD for pool IDs */
function datePart(d) {
  return d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
}

function buildPoolId(homeAbbr, awayAbbr, dateObj) {
  return "pool-" + homeAbbr.toLowerCase() + "-" + awayAbbr.toLowerCase() + "-" + datePart(dateObj);
}

/** Assign cost tier based on player name */
function playerCost(name) {
  var n = (name || "").toLowerCase().trim();
  if (TIER4.has(n)) return 4;
  if (TIER3.has(n)) return 3;
  if (TIER2.has(n)) return 2;
  return 1;
}

/** Normalise Sportradar position codes */
function mapPosition(pos) {
  var p = (pos || "").toUpperCase().trim();
  if (p === "PG" || p === "G")  return "PG";
  if (p === "SG")               return "SG";
  if (p === "SF" || p === "F")  return "SF";
  if (p === "PF")               return "PF";
  if (p === "C")                return "C";
  return pos || "F";
}

/**
 * Pick up to MAX_PER_TEAM players, prioritising higher-cost players.
 */
function pickPlayers(players, max) {
  if (players.length <= max) return players;
  var sorted = players.slice().sort(function(a, b) {
    if (b.cost !== a.cost) return b.cost - a.cost;
    return a.name.localeCompare(b.name);
  });
  return sorted.slice(0, max);
}

// ── Sportradar API calls ───────────────────────────────────────────────────────
async function fetchSchedule(dateObj) {
  var ds  = dateStr(dateObj);
  var url = BASE_URL + "/games/" + ds + "/schedule.json?api_key=" + API_KEY;
  console.log("[generateSnapshots] Fetching schedule:", ds);
  return fetchJSON(url);
}

async function fetchRoster(teamId) {
  var url = BASE_URL + "/teams/" + teamId + "/profile.json?api_key=" + API_KEY;
  console.log("[generateSnapshots] Fetching roster for team:", teamId);
  return fetchJSON(url);
}

// ── Map Sportradar game → pool object ─────────────────────────────────────────
function gameToPool(g, day, dateObj) {
  var home     = g.home || {};
  var away     = g.away || {};
  var homeAbbr = (home.alias || home.abbr || "HOM").toUpperCase();
  var awayAbbr = (away.alias || away.abbr || "AWY").toUpperCase();
  var pid      = buildPoolId(homeAbbr, awayAbbr, dateObj);

  var lockAtISO;
  if (g.scheduled) {
    lockAtISO = new Date(new Date(g.scheduled).getTime() - LOCK_OFFSET_MS).toISOString();
  } else {
    var hoursAhead = day === "today" ? 4 : 28;
    lockAtISO = new Date(Date.now() + hoursAhead * 3600000).toISOString();
  }

  return {
    id:         pid,
    srGameId:   g.id || null,
    label:      homeAbbr + " vs " + awayAbbr,
    title:      (home.name || homeAbbr) + " vs " + (away.name || awayAbbr),
    homeTeam:   { abbr: homeAbbr, name: home.name || homeAbbr, id: home.id || null },
    awayTeam:   { abbr: awayAbbr, name: away.name || awayAbbr, id: away.id || null },
    lockAt:     lockAtISO,
    rosterSize: 5,
    salaryCap:  10,
    status:     "open",
    day:        day,
    gameDate:   dateStr(dateObj).replace(/\//g, "-"),
  };
}

// ── Map Sportradar player → snapshot player ───────────────────────────────────
function mapPlayer(p, teamAbbr, teamFull) {
  var firstName = p.first_name || "";
  var lastName  = p.last_name  || "";
  var fullName  = (p.full_name || p.name || (firstName + " " + lastName)).trim();
  var injStatus = null;
  if (Array.isArray(p.injuries) && p.injuries.length > 0) {
    injStatus = (p.injuries[0].status || "QUESTIONABLE").toUpperCase();
  }
  return {
    id:           "sr-" + (p.id || fullName.replace(/\s+/g, "-").toLowerCase()),
    name:         fullName,
    team:         teamAbbr,
    teamFull:     teamFull,
    position:     mapPosition(p.primary_position || p.position || ""),
    cost:         playerCost(fullName),
    injuryStatus: injStatus,
  };
}

// ── Main generator ─────────────────────────────────────────────────────────────
async function generate() {
  if (!API_KEY) {
    console.error("[generateSnapshots] SPORTRADAR_API_KEY not set — aborting (existing snapshots preserved)");
    return;
  }

  var now      = new Date();
  var tomorrow = new Date(now.getTime() + 24 * 3600000);

  // ── Step 1: Fetch schedules ────────────────────────────────────────────────
  var allGames = [];
  for (var dayInfo of [{ d: now, label: "today" }, { d: tomorrow, label: "tomorrow" }]) {
    try {
      var sched = await fetchSchedule(dayInfo.d);
      var games = (sched.games || []).filter(function(g) {
        // Only keep scheduled (not yet started) games
        var st = (g.status || "").toLowerCase();
        return st === "scheduled" || st === "created";
      });
      console.log("[generateSnapshots]", dayInfo.label, ":", games.length, "scheduled game(s)");
      games.forEach(function(g) { g._day = dayInfo.label; g._dateObj = dayInfo.d; });
      allGames = allGames.concat(games);
    } catch (e) {
      if (e.code === 429) {
        console.error("[generateSnapshots] Rate limited fetching schedule for", dayInfo.label, "— skipping");
      } else {
        console.error("[generateSnapshots] Error fetching schedule for", dayInfo.label, ":", e.message);
      }
    }
    await sleep(1500); // respect rate limit between schedule calls
  }

  if (allGames.length === 0) {
    console.warn("[generateSnapshots] No scheduled games found — existing snapshots preserved");
    return;
  }

  // Limit total pools
  var gamesToProcess = allGames.slice(0, MAX_POOLS);

  // ── Step 2: Build pool objects ─────────────────────────────────────────────
  var pools = gamesToProcess.map(function(g) {
    return gameToPool(g, g._day, g._dateObj);
  });

  var now_iso = new Date().toISOString();

  // Write pools snapshot immediately (available even if roster fetch fails)
  var poolsSnap = {
    dataMode:    "SNAPSHOT",
    generatedAt: now_iso,
    updatedAt:   now_iso,
    pools:       pools,
  };
  writeJSON(path.join(SNAP_DIR, "pools.snapshot.json"), poolsSnap);
  console.log("[generateSnapshots] Wrote pools.snapshot.json with", pools.length, "pool(s)");

  // ── Step 3: Fetch rosters for each pool ───────────────────────────────────
  var allFallbackPlayers = [];
  var rateHit = false;

  for (var j = 0; j < pools.length; j++) {
    if (rateHit) break;

    var pool    = pools[j];
    var players = [];

    // Fetch home team roster
    if (pool.homeTeam.id) {
      try {
        await sleep(1500);
        var homeData    = await fetchRoster(pool.homeTeam.id);
        var homePlayers = (homeData.players || homeData.roster || [])
          .map(function(p) { return mapPlayer(p, pool.homeTeam.abbr, pool.homeTeam.name); })
          .filter(function(p) { return p.name.length > 2; });
        homePlayers = pickPlayers(homePlayers, MAX_PER_TEAM);
        players = players.concat(homePlayers);
        console.log("[generateSnapshots] Home", pool.homeTeam.abbr, ":", homePlayers.length, "players (kept)");
      } catch (e) {
        if (e.code === 429) {
          console.error("[generateSnapshots] Rate limited on home roster for", pool.homeTeam.abbr, "— stopping roster fetch");
          rateHit = true;
        } else {
          console.error("[generateSnapshots] Error fetching home roster for", pool.homeTeam.abbr, ":", e.message);
        }
      }
    }

    if (rateHit) break;

    // Fetch away team roster
    if (pool.awayTeam.id) {
      try {
        await sleep(1500);
        var awayData    = await fetchRoster(pool.awayTeam.id);
        var awayPlayers = (awayData.players || awayData.roster || [])
          .map(function(p) { return mapPlayer(p, pool.awayTeam.abbr, pool.awayTeam.name); })
          .filter(function(p) { return p.name.length > 2; });
        awayPlayers = pickPlayers(awayPlayers, MAX_PER_TEAM);
        players = players.concat(awayPlayers);
        console.log("[generateSnapshots] Away", pool.awayTeam.abbr, ":", awayPlayers.length, "players (kept)");
      } catch (e) {
        if (e.code === 429) {
          console.error("[generateSnapshots] Rate limited on away roster for", pool.awayTeam.abbr, "— stopping roster fetch");
          rateHit = true;
        } else {
          console.error("[generateSnapshots] Error fetching away roster for", pool.awayTeam.abbr, ":", e.message);
        }
      }
    }

    if (players.length > 0) {
      writeJSON(path.join(SNAP_DIR, "players." + pool.id + ".json"), players);
      console.log("[generateSnapshots] Wrote players." + pool.id + ".json with", players.length, "players");
      allFallbackPlayers = allFallbackPlayers.concat(players);
    } else {
      var existingPath = path.join(SNAP_DIR, "players." + pool.id + ".json");
      if (!fs.existsSync(existingPath)) {
        console.warn("[generateSnapshots] No players for pool", pool.id, "and no existing file — pool will use fallback");
      } else {
        console.log("[generateSnapshots] Kept existing players file for pool", pool.id);
      }
    }
  }

  // ── Step 4: Write combined fallback ───────────────────────────────────────
  if (allFallbackPlayers.length > 0) {
    writeJSON(path.join(SNAP_DIR, "players.fallback.json"), allFallbackPlayers);
    console.log("[generateSnapshots] Wrote players.fallback.json with", allFallbackPlayers.length, "players total");
  }

  console.log("[generateSnapshots] Done. Generated", pools.length, "pool(s).");
}

// ── Run ────────────────────────────────────────────────────────────────────────
generate().catch(function(e) {
  console.error("[generateSnapshots] Fatal error:", e.message);
  // Do NOT exit(1) — keep existing snapshot files intact
  process.exit(0);
});
