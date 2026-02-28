#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates today + tomorrow NBA pools + player snapshots.
 *
 * Priority:
 *   1. Sportradar (if SPORTRADAR_API_KEY set and no 429)
 *   2. BallDontLie free API (no key required) — automatic fallback
 *   3. Keep existing snapshots unchanged (if both sources fail)
 *
 * Zero sqlite / better-sqlite3 / DB dependencies.
 * Runtime (Cloud Run) NEVER calls this script — it only reads the output JSON.
 *
 * Usage:
 *   node scripts/generateSnapshots.js
 *   SPORTRADAR_API_KEY=xxx node scripts/generateSnapshots.js
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const SNAP_DIR       = path.join(__dirname, "..", "data", "snapshots");
const SR_KEY         = process.env.SPORTRADAR_API_KEY || "";
const SR_LEVEL       = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";
const SR_BASE        = `https://api.sportradar.com/nba/${SR_LEVEL}/v8/en`;
const BDL_BASE       = "https://api.balldontlie.io/v1";
const BDL_KEY        = process.env.BALLDONTLIE_API_KEY || "";
const THROTTLE_MS    = 1200;   // 1.2 s between requests
const MAX_PER_TEAM   = 9;      // max players to keep per team
const ROSTER_SIZE    = 5;
const SALARY_CAP     = 10;

// ── Cost tier lookup (by last name or full name) ──────────────────────────────
const TIER4 = new Set([
  "LeBron James","Anthony Davis","Stephen Curry","Kevin Durant","Giannis Antetokounmpo",
  "Nikola Jokic","Luka Doncic","Joel Embiid","Jayson Tatum","Damian Lillard",
  "Shai Gilgeous-Alexander","Devin Booker","Trae Young","Donovan Mitchell",
  "Kawhi Leonard","Paul George","Jimmy Butler","Bam Adebayo","Tyrese Haliburton",
  "Ja Morant","Zion Williamson","Anthony Edwards","Cade Cunningham","Evan Mobley",
  "Scottie Barnes","Franz Wagner","Lauri Markkanen","Darius Garland","Jalen Brunson",
  "Karl-Anthony Towns","Rudy Gobert","De\'Aaron Fox","Khris Middleton","Bradley Beal",
  "Kyrie Irving","Klay Thompson","Draymond Green","Jaylen Brown","Marcus Smart",
]);
const TIER3 = new Set([
  "Austin Reaves","D\'Angelo Russell","Rui Hachimura","Lonnie Walker","Max Christie",
  "Jalen Williams","Luguentz Dort","Josh Giddey","Aaron Wiggins","Kenrich Williams",
  "Mikal Bridges","OG Anunoby","Julius Randle","Immanuel Quickley","RJ Barrett",
  "Tobias Harris","Tyrese Maxey","De\'Anthony Melton","Kelly Oubre","Nicolas Batum",
  "Andrew Wiggins","Jonathan Kuminga","Moses Moody","Gary Payton II","Kevon Looney",
  "Derrick White","Al Horford","Robert Williams","Grant Williams","Sam Hauser",
  "Tyler Herro","Duncan Robinson","Caleb Martin","Kyle Lowry","Udonis Haslem",
  "Jaren Jackson Jr.","Desmond Bane","Luke Kennard","Brandon Clarke","Steven Adams",
]);
const TIER2 = new Set([
  "Taurean Prince","Jarred Vanderbilt","Wenyen Gabriel","Damian Jones","Jaxson Hayes",
  "Hamidou Diallo","Tre Mann","Isaiah Joe","Aleksej Pokusevski","Lindy Waters",
  "Obi Toppin","Quentin Grimes","Miles McBride","Jericho Sims","Evan Fournier",
  "Shake Milton","Furkan Korkmaz","Paul Reed","Montrezl Harrell","Matisse Thybulle",
  "Nemanja Bjelica","Damion Lee","Andre Iguodala","James Wiseman","Patrick Baldwin",
  "Payton Pritchard","Luke Kornet","Brodric Thomas","Nik Stauskas","Jabari Parker",
  "Udoka Azubuike","Killian Tillie","Svi Mykhailiuk","Gabe Vincent","Omer Yurtseven",
  "Nikola Jovic","Jamal Cain","Orlando Robinson","KZ Okpala","Dru Smith",
]);

function costForPlayer(name) {
  if (TIER4.has(name)) return 4;
  if (TIER3.has(name)) return 3;
  if (TIER2.has(name)) return 2;
  return 1;
}

function pickPlayers(players, max) {
  return players
    .sort(function(a, b) { return b.cost - a.cost; })
    .slice(0, max);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function nowISO() { return new Date().toISOString(); }

function dateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "/" + m + "/" + day;
}

function poolId(homeAbbr, awayAbbr, dateTag) {
  return "pool-" + homeAbbr.toLowerCase() + "-" + awayAbbr.toLowerCase() + "-" + dateTag;
}

function safeWrite(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log("[gen] Wrote:", filePath);
    return true;
  } catch (e) {
    console.error("[gen] Failed to write", filePath, e.message);
    return false;
  }
}

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch (_) { return false; }
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────
function fetchJSON(url, headers) {
  return new Promise(function(resolve, reject) {
    var opts = { headers: Object.assign({ "Accept": "application/json" }, headers || {}) };
    var req = https.get(url, opts, function(res) {
      var body = "";
      res.on("data", function(c) { body += c; });
      res.on("end", function() {
        if (res.statusCode === 429) {
          var err = new Error("RATE_LIMITED");
          err.statusCode = 429;
          return reject(err);
        }
        if (res.statusCode >= 400) {
          var err2 = new Error("HTTP_" + res.statusCode);
          err2.statusCode = res.statusCode;
          return reject(err2);
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSON_PARSE_ERROR: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, function() { req.destroy(new Error("TIMEOUT")); });
  });
}

// ── Sportradar source ─────────────────────────────────────────────────────────
async function srFetchSchedule(dateStr) {
  var url = SR_BASE + "/games/" + dateStr + "/schedule.json?api_key=" + SR_KEY;
  console.log("[SR] Fetching schedule:", dateStr);
  return fetchJSON(url);
}

async function srFetchRoster(teamId) {
  var url = SR_BASE + "/teams/" + teamId + "/profile.json?api_key=" + SR_KEY;
  console.log("[SR] Fetching roster:", teamId);
  return fetchJSON(url);
}

function srMapPlayer(p, teamAbbr) {
  var name = (p.full_name || ((p.first_name || "") + " " + (p.last_name || "")).trim());
  return {
    id:           "sr-" + (p.id || p.sr_id || name.replace(/\s+/g, "-").toLowerCase()),
    name:         name,
    team:         teamAbbr,
    teamFull:     "",
    position:     p.primary_position || p.position || "F",
    cost:         costForPlayer(name),
    injuryStatus: (p.injuries && p.injuries.length > 0) ? (p.injuries[0].status || "QUESTIONABLE") : null,
  };
}

async function generateFromSportradar(today, tomorrow) {
  if (!SR_KEY) { console.log("[SR] No API key — skipping Sportradar"); return null; }

  var allPools   = [];
  var playerMap  = {};
  var rateHit    = false;

  for (var i = 0; i < 2; i++) {
    var d    = i === 0 ? today : tomorrow;
    var tag  = i === 0 ? "today" : "tmrw";
    var ds   = dateStr(d);
    var sched;
    try {
      sched = await srFetchSchedule(ds);
      await sleep(THROTTLE_MS);
    } catch (e) {
      console.warn("[SR] Schedule fetch failed (" + ds + "):", e.message);
      if (e.statusCode === 429) rateHit = true;
      continue;
    }

    var games = (sched.games || []).filter(function(g) {
      return g.status === "scheduled" || g.status === "created";
    });
    console.log("[SR] " + ds + ": " + games.length + " scheduled games");

    for (var j = 0; j < games.length; j++) {
      if (rateHit) break;
      var g = games[j];
      var homeAbbr = (g.home && (g.home.alias || g.home.abbr || g.home.market || "HOM")).toUpperCase();
      var awayAbbr = (g.away && (g.away.alias || g.away.abbr || g.away.market || "AWY")).toUpperCase();
      var homeName = (g.home && (g.home.name ? g.home.market + " " + g.home.name : g.home.alias)) || homeAbbr;
      var awayName = (g.away && (g.away.name ? g.away.market + " " + g.away.name : g.away.alias)) || awayAbbr;
      var pid = poolId(homeAbbr, awayAbbr, tag);

      allPools.push({
        id:        pid,
        label:     homeAbbr + " vs " + awayAbbr,
        title:     homeName + " vs " + awayName,
        homeTeam:  { abbr: homeAbbr, name: homeName },
        awayTeam:  { abbr: awayAbbr, name: awayName },
        lockAt:    g.scheduled || new Date(d.getTime() + 23 * 3600000).toISOString(),
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       tag,
        source:    "sportradar",
      });

      // Fetch rosters
      var homePlayers = [], awayPlayers = [];
      try {
        var homeProfile = await srFetchRoster(g.home.id);
        await sleep(THROTTLE_MS);
        homePlayers = (homeProfile.players || []).map(function(p) { return srMapPlayer(p, homeAbbr); });
      } catch (e) {
        console.warn("[SR] Home roster failed:", e.message);
        if (e.statusCode === 429) rateHit = true;
      }
      try {
        var awayProfile = await srFetchRoster(g.away.id);
        await sleep(THROTTLE_MS);
        awayPlayers = (awayProfile.players || []).map(function(p) { return srMapPlayer(p, awayAbbr); });
      } catch (e) {
        console.warn("[SR] Away roster failed:", e.message);
        if (e.statusCode === 429) rateHit = true;
      }

      var combined = pickPlayers(homePlayers, MAX_PER_TEAM).concat(pickPlayers(awayPlayers, MAX_PER_TEAM));
      if (combined.length >= 10) playerMap[pid] = combined;
    }
  }

  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "sportradar" };
}

// ── BallDontLie fallback source ───────────────────────────────────────────────
// Free NBA API — no key required for basic endpoints (rate limit: 60 req/min)
async function bdlFetchGames(dateISO) {
  // dateISO: "2026-03-01"
  var url = BDL_BASE + "/games?dates[]=" + dateISO + "&per_page=20";
  var headers = BDL_KEY ? { "Authorization": BDL_KEY } : {};
  console.log("[BDL] Fetching games:", dateISO);
  return fetchJSON(url, headers);
}

async function bdlFetchRoster(teamId) {
  var url = BDL_BASE + "/players?team_ids[]=" + teamId + "&per_page=30&active=true";
  var headers = BDL_KEY ? { "Authorization": BDL_KEY } : {};
  console.log("[BDL] Fetching roster for team:", teamId);
  return fetchJSON(url, headers);
}

function bdlDateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function bdlMapPlayer(p, teamAbbr) {
  var name = (p.first_name || "") + " " + (p.last_name || "");
  name = name.trim();
  return {
    id:           "bdl-" + p.id,
    name:         name,
    team:         teamAbbr,
    teamFull:     (p.team && p.team.full_name) || teamAbbr,
    position:     p.position || "F",
    cost:         costForPlayer(name),
    injuryStatus: null,
  };
}

async function generateFromBallDontLie(today, tomorrow) {
  var allPools  = [];
  var playerMap = {};

  for (var i = 0; i < 2; i++) {
    var d   = i === 0 ? today : tomorrow;
    var tag = i === 0 ? "today" : "tmrw";
    var ds  = bdlDateStr(d);
    var resp;
    try {
      resp = await bdlFetchGames(ds);
      await sleep(THROTTLE_MS);
    } catch (e) {
      console.warn("[BDL] Games fetch failed (" + ds + "):", e.message);
      continue;
    }

    var games = resp.data || [];
    console.log("[BDL] " + ds + ": " + games.length + " games");

    for (var j = 0; j < games.length; j++) {
      var g = games[j];
      var homeAbbr = (g.home_team && g.home_team.abbreviation) || "HOM";
      var awayAbbr = (g.visitor_team && g.visitor_team.abbreviation) || "AWY";
      var homeName = (g.home_team && g.home_team.full_name) || homeAbbr;
      var awayName = (g.visitor_team && g.visitor_team.full_name) || awayAbbr;
      var pid = poolId(homeAbbr, awayAbbr, tag);

      allPools.push({
        id:        pid,
        label:     homeAbbr + " vs " + awayAbbr,
        title:     homeName + " vs " + awayName,
        homeTeam:  { abbr: homeAbbr, name: homeName },
        awayTeam:  { abbr: awayAbbr, name: awayName },
        lockAt:    g.date || new Date(d.getTime() + 23 * 3600000).toISOString(),
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       tag,
        source:    "balldontlie",
      });

      // Fetch rosters
      var homePlayers = [], awayPlayers = [];
      try {
        var homeResp = await bdlFetchRoster(g.home_team.id);
        await sleep(THROTTLE_MS);
        homePlayers = (homeResp.data || []).map(function(p) { return bdlMapPlayer(p, homeAbbr); });
      } catch (e) {
        console.warn("[BDL] Home roster failed:", e.message);
      }
      try {
        var awayResp = await bdlFetchRoster(g.visitor_team.id);
        await sleep(THROTTLE_MS);
        awayPlayers = (awayResp.data || []).map(function(p) { return bdlMapPlayer(p, awayAbbr); });
      } catch (e) {
        console.warn("[BDL] Away roster failed:", e.message);
      }

      var combined = pickPlayers(homePlayers, MAX_PER_TEAM).concat(pickPlayers(awayPlayers, MAX_PER_TEAM));
      if (combined.length >= 10) playerMap[pid] = combined;
    }
  }

  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "balldontlie" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  var now      = new Date();
  var today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var tomorrow = new Date(today.getTime() + 86400000);

  console.log("[gen] Starting snapshot generation:", nowISO());
  console.log("[gen] Today:", dateStr(today), "| Tomorrow:", dateStr(tomorrow));
  console.log("[gen] Sportradar key:", SR_KEY ? "SET" : "NOT SET");

  var result = null;

  // 1. Try Sportradar
  try {
    result = await generateFromSportradar(today, tomorrow);
    if (result) console.log("[gen] Sportradar: got", result.pools.length, "pools");
  } catch (e) {
    console.warn("[gen] Sportradar failed:", e.message);
  }

  // 2. Fallback: BallDontLie
  if (!result) {
    console.log("[gen] Falling back to BallDontLie...");
    try {
      result = await generateFromBallDontLie(today, tomorrow);
      if (result) console.log("[gen] BallDontLie: got", result.pools.length, "pools");
    } catch (e) {
      console.warn("[gen] BallDontLie failed:", e.message);
    }
  }

  // 3. If both fail — keep existing snapshots
  if (!result || result.pools.length === 0) {
    console.warn("[gen] All sources failed — existing snapshots preserved (not overwritten)");
    process.exit(0);
  }

  // ── Write pools.snapshot.json ──────────────────────────────────────────────
  var poolsFile = path.join(SNAP_DIR, "pools.snapshot.json");
  var poolsData = {
    dataMode:    "SNAPSHOT",
    source:      result.source,
    generatedAt: nowISO(),
    updatedAt:   nowISO(),
    pools:       result.pools,
  };
  safeWrite(poolsFile, poolsData);

  // ── Write players.<poolId>.json ────────────────────────────────────────────
  result.pools.forEach(function(pool) {
    var players = result.playerMap[pool.id];
    if (!players || players.length === 0) {
      console.warn("[gen] No players for pool:", pool.id, "— skipping player file");
      return;
    }
    var pFile = path.join(SNAP_DIR, "players." + pool.id + ".json");
    safeWrite(pFile, players);
  });

  console.log("[gen] Done. Pools:", result.pools.length);
  console.log("[gen] Pool IDs:", result.pools.map(function(p) { return p.id; }).join(", "));

  // ── Quick smoke test ───────────────────────────────────────────────────────
  console.log("\n[gen] === Quick Smoke Test ===");
  var poolsCheck = JSON.parse(fs.readFileSync(poolsFile, "utf8"));
  console.log("[gen] /api/pools would return:", poolsCheck.pools.length, "pools");
  if (poolsCheck.pools.length > 0) {
    var firstPool = poolsCheck.pools[0];
    console.log("[gen] First pool:", firstPool.id, "|", firstPool.title);
    var pFile2 = path.join(SNAP_DIR, "players." + firstPool.id + ".json");
    if (fileExists(pFile2)) {
      var pp = JSON.parse(fs.readFileSync(pFile2, "utf8"));
      console.log("[gen] /api/players?poolId=" + firstPool.id + " would return:", pp.length, "players");
      console.log("[gen] First 3 players:", pp.slice(0, 3).map(function(p) { return p.name + " (" + p.team + ", $" + p.cost + ")"; }).join(", "));
    }
  }
}

main().catch(function(e) {
  console.error("[gen] Fatal:", e.message || e);
  process.exit(1);
});
