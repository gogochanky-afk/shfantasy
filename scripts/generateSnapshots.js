#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side snapshot generator.
 * Calls Sportradar NBA API to fetch today+tomorrow schedule and team rosters,
 * then writes:
 *   data/snapshots/pools.snapshot.json
 *   data/snapshots/players.<poolId>.json  (one per game)
 *   data/snapshots/players.fallback.json  (all players combined)
 *
 * Usage:
 *   SPORTRADAR_API_KEY=xxx node scripts/generateSnapshots.js
 *   or via admin endpoint: POST /api/admin/generate-snapshots
 *
 * If Sportradar fails (quota/rate-limit/network), existing snapshot files
 * are preserved and an error is logged. Runtime is NEVER broken.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY       = process.env.SPORTRADAR_API_KEY || "";
const ACCESS_LEVEL  = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";
const BASE_URL      = `https://api.sportradar.com/nba/${ACCESS_LEVEL}/v8/en`;
const SNAP_DIR      = path.join(__dirname, "..", "data", "snapshots");
const LOCK_OFFSET_MS = 10 * 60 * 1000; // 10 minutes before game start

// Star players list for cost heuristic (expand as needed)
const STARS = new Set([
  "lebron james","stephen curry","kevin durant","giannis antetokounmpo",
  "luka doncic","nikola jokic","joel embiid","jayson tatum","damian lillard",
  "devin booker","trae young","ja morant","zion williamson","anthony davis",
  "kawhi leonard","paul george","jimmy butler","bam adebayo","donovan mitchell",
  "tyrese haliburton","shai gilgeous-alexander","victor wembanyama",
  "cade cunningham","jalen brunson","anthony edwards","jaylen brown",
  "pascal siakam","darius garland","lauri markkanen","julius randle",
  "karl-anthony towns","rudy gobert","de'aaron fox","brandon ingram",
  "zach lavine","kyrie irving","james harden","russell westbrook",
  "chris paul","klay thompson","draymond green","andrew wiggins",
]);

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
        catch(e) { reject(new Error("JSON parse error: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, function() { req.destroy(new Error("TIMEOUT")); });
  });
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

function writeJSON(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
}

function dateStr(d) {
  // YYYY/MM/DD for Sportradar schedule endpoint
  var y = d.getUTCFullYear();
  var m = String(d.getUTCMonth() + 1).padStart(2, "0");
  var dd = String(d.getUTCDate()).padStart(2, "0");
  return y + "/" + m + "/" + dd;
}

function poolId(homeAbbr, awayAbbr, dateISO) {
  // pool-<HOME>-<AWAY>-<YYYYMMDD>
  var d = dateISO.slice(0, 10).replace(/-/g, "");
  return "pool-" + homeAbbr.toLowerCase() + "-" + awayAbbr.toLowerCase() + "-" + d;
}

function playerCost(name) {
  if (STARS.has((name || "").toLowerCase())) return 4;
  return 2; // default role player cost
}

function mapPosition(pos) {
  var p = (pos || "").toUpperCase();
  if (p === "PG" || p === "G") return "PG";
  if (p === "SG") return "SG";
  if (p === "SF" || p === "F") return "SF";
  if (p === "PF") return "PF";
  if (p === "C")  return "C";
  return pos || "F";
}

// ── Sportradar API calls ───────────────────────────────────────────────────────
async function fetchSchedule(dateObj) {
  var ds = dateStr(dateObj);
  var url = BASE_URL + "/games/" + ds + "/schedule.json?api_key=" + API_KEY;
  console.log("[generateSnapshots] Fetching schedule:", ds);
  return fetchJSON(url);
}

async function fetchRoster(teamId) {
  var url = BASE_URL + "/teams/" + teamId + "/profile.json?api_key=" + API_KEY;
  return fetchJSON(url);
}

// ── Main generator ─────────────────────────────────────────────────────────────
async function generate() {
  if (!API_KEY) {
    console.error("[generateSnapshots] SPORTRADAR_API_KEY not set. Aborting.");
    process.exit(1);
  }

  var now = new Date();
  var tomorrow = new Date(now.getTime() + 86400000);

  var allGames = [];

  // Fetch today's schedule
  try {
    var todayData = await fetchSchedule(now);
    if (todayData && Array.isArray(todayData.games)) {
      todayData.games.forEach(function(g) { g._day = "today"; });
      allGames = allGames.concat(todayData.games);
    }
  } catch(e) {
    if (e.code === 429) { console.error("[generateSnapshots] Rate limited on today schedule. Keeping existing files."); return; }
    console.error("[generateSnapshots] Error fetching today schedule:", e.message);
  }

  await sleep(1200); // respect rate limit

  // Fetch tomorrow's schedule
  try {
    var tmrwData = await fetchSchedule(tomorrow);
    if (tmrwData && Array.isArray(tmrwData.games)) {
      tmrwData.games.forEach(function(g) { g._day = "tomorrow"; });
      allGames = allGames.concat(tmrwData.games);
    }
  } catch(e) {
    if (e.code === 429) { console.error("[generateSnapshots] Rate limited on tomorrow schedule. Keeping existing files."); return; }
    console.error("[generateSnapshots] Error fetching tomorrow schedule:", e.message);
  }

  if (allGames.length === 0) {
    console.warn("[generateSnapshots] No games found. Keeping existing snapshot files.");
    return;
  }

  // Build pools
  var pools = [];
  var allFallbackPlayers = [];

  for (var i = 0; i < allGames.length; i++) {
    var g = allGames[i];
    var home = g.home || {};
    var away = g.away || {};
    var homeAbbr = (home.alias || home.abbr || "HOM").toUpperCase();
    var awayAbbr = (away.alias || away.abbr || "AWY").toUpperCase();
    var gameDate = g.scheduled ? g.scheduled.slice(0, 10) : dateStr(i === 0 ? now : tomorrow);
    var pid = poolId(homeAbbr, awayAbbr, gameDate);

    // lockAt = scheduled start - 10 min
    var lockAtISO;
    if (g.scheduled) {
      lockAtISO = new Date(new Date(g.scheduled).getTime() - LOCK_OFFSET_MS).toISOString();
    } else {
      lockAtISO = new Date(now.getTime() + (g._day === "today" ? 4 : 28) * 3600000).toISOString();
    }

    pools.push({
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
      day:        g._day || "today",
      gameDate:   gameDate,
    });
  }

  // Write pools snapshot
  var poolsSnap = {
    dataMode:  "SNAPSHOT",
    generatedAt: new Date().toISOString(),
    pools:     pools,
  };
  writeJSON(path.join(SNAP_DIR, "pools.snapshot.json"), poolsSnap);
  console.log("[generateSnapshots] Wrote pools.snapshot.json with", pools.length, "pools");

  // Fetch rosters for each pool
  for (var j = 0; j < pools.length; j++) {
    var pool = pools[j];
    var players = [];

    // Fetch home roster
    if (pool.homeTeam.id) {
      try {
        await sleep(1200);
        var homeRoster = await fetchRoster(pool.homeTeam.id);
        var homePlayers = (homeRoster.players || homeRoster.roster || []);
        homePlayers.forEach(function(p) {
          var fullName = (p.full_name || p.name || (p.first_name + " " + p.last_name) || "").trim();
          players.push({
            id:          "sr-" + (p.id || fullName.replace(/\s+/g, "-").toLowerCase()),
            name:        fullName,
            team:        pool.homeTeam.abbr,
            teamFull:    pool.homeTeam.name,
            position:    mapPosition(p.primary_position || p.position),
            cost:        playerCost(fullName),
            injuryStatus: p.injuries && p.injuries.length > 0 ? (p.injuries[0].status || "QUESTIONABLE") : null,
          });
        });
        console.log("[generateSnapshots] Home roster", pool.homeTeam.abbr, ":", homePlayers.length, "players");
      } catch(e) {
        if (e.code === 429) { console.error("[generateSnapshots] Rate limited on roster. Stopping."); break; }
        console.error("[generateSnapshots] Error fetching home roster for", pool.homeTeam.abbr, ":", e.message);
      }
    }

    // Fetch away roster
    if (pool.awayTeam.id) {
      try {
        await sleep(1200);
        var awayRoster = await fetchRoster(pool.awayTeam.id);
        var awayPlayers = (awayRoster.players || awayRoster.roster || []);
        awayPlayers.forEach(function(p) {
          var fullName = (p.full_name || p.name || (p.first_name + " " + p.last_name) || "").trim();
          players.push({
            id:          "sr-" + (p.id || fullName.replace(/\s+/g, "-").toLowerCase()),
            name:        fullName,
            team:        pool.awayTeam.abbr,
            teamFull:    pool.awayTeam.name,
            position:    mapPosition(p.primary_position || p.position),
            cost:        playerCost(fullName),
            injuryStatus: p.injuries && p.injuries.length > 0 ? (p.injuries[0].status || "QUESTIONABLE") : null,
          });
        });
        console.log("[generateSnapshots] Away roster", pool.awayTeam.abbr, ":", awayPlayers.length, "players");
      } catch(e) {
        if (e.code === 429) { console.error("[generateSnapshots] Rate limited on roster. Stopping."); break; }
        console.error("[generateSnapshots] Error fetching away roster for", pool.awayTeam.abbr, ":", e.message);
      }
    }

    if (players.length > 0) {
      writeJSON(path.join(SNAP_DIR, "players." + pool.id + ".json"), players);
      console.log("[generateSnapshots] Wrote players." + pool.id + ".json with", players.length, "players");
      allFallbackPlayers = allFallbackPlayers.concat(players);
    }
  }

  // Write fallback players (all combined)
  if (allFallbackPlayers.length > 0) {
    writeJSON(path.join(SNAP_DIR, "players.fallback.json"), allFallbackPlayers);
    console.log("[generateSnapshots] Wrote players.fallback.json with", allFallbackPlayers.length, "players");
  }

  console.log("[generateSnapshots] Done.");
}

// ── Run ────────────────────────────────────────────────────────────────────────
generate().catch(function(e) {
  console.error("[generateSnapshots] Fatal error:", e.message);
  // Do NOT exit(1) — keep existing snapshot files intact
  process.exit(0);
});
