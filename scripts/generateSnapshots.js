#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates data/snapshots/pools.snapshot.json and
 * data/snapshots/players.<poolId>.json for today + tomorrow.
 *
 * Source priority:
 *   1. Sportradar (if SPORTRADAR_API_KEY is set)
 *   2. ESPN public API (no key required, always current rosters)
 *   3. BallDontLie schedule + ESPN rosters (if BDL_KEY available)
 *   4. Keep existing snapshots unchanged (if all sources fail)
 *
 * Throttling:
 *   - All HTTP requests are serial with >= THROTTLE_MS (1200ms) gap
 *   - 429: exponential backoff (2s → 4s → 8s → 16s → 20s cap), max 5 retries
 *
 * Zero sqlite / better-sqlite3 / DB dependencies.
 * Runtime (Cloud Run) NEVER calls this script — only reads the output JSON.
 *
 * Usage:
 *   node scripts/generateSnapshots.js
 *   SPORTRADAR_API_KEY=xxx node scripts/generateSnapshots.js
 *   BALLDONTLIE_API_KEY=xxx node scripts/generateSnapshots.js
 */

var https = require("https");
var fs    = require("fs");
var path  = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
var SR_KEY         = process.env.SPORTRADAR_API_KEY          || "";
var SR_LEVEL       = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";
var BDL_KEY        = process.env.BALLDONTLIE_API_KEY         || "";
var THROTTLE_MS    = 1200;   // min gap between requests (ms)
var MAX_RETRIES    = 5;
var MAX_BACKOFF_MS = 20000;
var ROSTER_SIZE    = 5;
var SALARY_CAP     = 10;
var MAX_PER_TEAM   = 9;      // max players per team in a pool
var MIN_PER_TEAM   = 7;      // min players per team in a pool

// ESPN uses non-standard abbreviations for some teams — normalise to standard
var ESPN_ABBR_FIX = {
  "GS":   "GSW",
  "NY":   "NYK",
  "SA":   "SAS",
  "NO":   "NOP",
  "UTAH": "UTA",
  "WSH":  "WAS",
};

// ESPN team id → slug (for roster endpoint)
var ESPN_SLUG = {
  "1":"atlanta-hawks","2":"boston-celtics","17":"brooklyn-nets","30":"charlotte-hornets",
  "4":"chicago-bulls","5":"cleveland-cavaliers","6":"dallas-mavericks","7":"denver-nuggets",
  "8":"detroit-pistons","9":"golden-state-warriors","10":"houston-rockets","11":"indiana-pacers",
  "12":"la-clippers","13":"los-angeles-lakers","29":"memphis-grizzlies","14":"miami-heat",
  "15":"milwaukee-bucks","16":"minnesota-timberwolves","3":"new-orleans-pelicans",
  "18":"new-york-knicks","25":"oklahoma-city-thunder","19":"orlando-magic",
  "20":"philadelphia-76ers","21":"phoenix-suns","22":"portland-trail-blazers",
  "23":"sacramento-kings","24":"san-antonio-spurs","28":"toronto-raptors",
  "26":"utah-jazz","27":"washington-wizards",
};

// Standard abbr → ESPN team id
var ESPN_ID_BY_ABBR = {
  "ATL":"1","BOS":"2","BKN":"17","CHA":"30","CHI":"4","CLE":"5",
  "DAL":"6","DEN":"7","DET":"8","GSW":"9","HOU":"10","IND":"11",
  "LAC":"12","LAL":"13","MEM":"29","MIA":"14","MIL":"15","MIN":"16",
  "NOP":"3","NYK":"18","OKC":"25","ORL":"19","PHI":"20","PHX":"21",
  "POR":"22","SAC":"23","SAS":"24","TOR":"28","UTA":"26","WAS":"27",
};

// ── Paths ─────────────────────────────────────────────────────────────────────
var SNAP_DIR = path.join(__dirname, "..", "data", "snapshots");
if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });

// ── Utilities ─────────────────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function dateStr(d) { return d.toISOString().slice(0, 10); }
function espnDateStr(d) { return d.toISOString().slice(0, 10).replace(/-/g, ""); }
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function fileExists(p) { try { return fs.existsSync(p); } catch (_) { return false; } }

function poolId(homeAbbr, awayAbbr, tag) {
  return "pool-" + homeAbbr.toLowerCase() + "-" + awayAbbr.toLowerCase() + "-" + tag;
}

function normAbbr(abbr) {
  return ESPN_ABBR_FIX[abbr] || abbr;
}

/** Write JSON safely: write to .tmp then rename (atomic) */
function safeWrite(filePath, data) {
  var tmp = filePath + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
    console.log("[gen] Written:", path.basename(filePath));
  } catch (e) {
    console.error("[gen] Write failed:", filePath, e.message);
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

// ── Throttled HTTP GET with exponential backoff on 429 ───────────────────────
var _lastRequestTime = 0;

async function fetchWithRetry(url, extraHeaders) {
  extraHeaders = extraHeaders || {};
  var attempt = 0;
  var backoff  = 2000;

  while (attempt <= MAX_RETRIES) {
    // Throttle: ensure >= THROTTLE_MS since last request
    var now  = Date.now();
    var wait = THROTTLE_MS - (now - _lastRequestTime);
    if (wait > 0) await sleep(wait);
    _lastRequestTime = Date.now();

    var result = await _httpGet(url, extraHeaders);

    if (result.status === 429) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        console.warn("[fetch] 429 after", MAX_RETRIES, "retries:", url.split("?")[0]);
        return result;
      }
      console.warn("[fetch] 429 – backoff", backoff + "ms (attempt " + attempt + "/" + MAX_RETRIES + ")");
      await sleep(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      continue;
    }

    return result;
  }
  return { status: 0, body: "" };
}

function _httpGet(url, extraHeaders) {
  return new Promise(function(resolve) {
    var opts = new URL(url);
    var headers = Object.assign({
      "User-Agent": "SHFantasy-SnapshotGen/2.0 (compatible)",
      "Accept":     "application/json",
    }, extraHeaders);
    https.get({
      hostname: opts.hostname,
      path:     opts.pathname + opts.search,
      headers:  headers,
    }, function(r) {
      var body = "";
      r.on("data", function(c) { body += c; });
      r.on("end",  function() { resolve({ status: r.statusCode, body: body }); });
    }).on("error", function(e) {
      resolve({ status: 0, body: "", error: e.message });
    });
  });
}

// ── Cost tier assignment ───────────────────────────────────────────────────────
/**
 * Assign 1-4 cost tiers to a list of players.
 * Uses position-based star weight:
 *   top 2 → $4, next 3 → $3, next 4 → $2, rest → $1
 */
function posWeight(pos) {
  if (!pos) return 1;
  var p = pos.toUpperCase();
  if (p === "C")                          return 4;
  if (p === "PF" || p === "SF")           return 3;
  if (p === "PG" || p === "SG")           return 2;
  if (p.indexOf("C") !== -1)              return 3;
  if (p.indexOf("F") !== -1)              return 2;
  return 1;
}

function assignCosts(players) {
  var sorted = players.slice().sort(function(a, b) {
    var wa = posWeight(a.position), wb = posWeight(b.position);
    if (wb !== wa) return wb - wa;
    return (a.name || "").localeCompare(b.name || "");
  });
  return sorted.map(function(p, i) {
    var cost = i < 2 ? 4 : i < 5 ? 3 : i < 9 ? 2 : 1;
    return Object.assign({}, p, { cost: cost });
  });
}

function pickPlayers(players, max, min) {
  if (players.length <= max) return players;
  var sorted = players.slice().sort(function(a, b) {
    if (b.cost !== a.cost) return b.cost - a.cost;
    return (a.name || "").localeCompare(b.name || "");
  });
  return sorted.slice(0, Math.max(min || 0, max));
}

// ── ESPN Source ───────────────────────────────────────────────────────────────

async function espnSchedule(dateYYYYMMDD) {
  var url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=" + dateYYYYMMDD;
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    console.warn("[ESPN] Schedule", dateYYYYMMDD, "returned HTTP", r.status);
    return [];
  }
  try {
    var d = JSON.parse(r.body);
    return (d.events || []).map(function(e) {
      var comps       = e.competitions && e.competitions[0];
      var competitors = (comps && comps.competitors) || [];
      var home = competitors.find(function(t) { return t.homeAway === "home"; });
      var away = competitors.find(function(t) { return t.homeAway === "away"; });
      if (!home || !away) return null;
      return {
        homeTeam: {
          id:   home.team.id,
          abbr: normAbbr(home.team.abbreviation),
          name: home.team.displayName,
        },
        awayTeam: {
          id:   away.team.id,
          abbr: normAbbr(away.team.abbreviation),
          name: away.team.displayName,
        },
        datetime: comps && comps.date,
      };
    }).filter(Boolean);
  } catch (e) {
    console.warn("[ESPN] Schedule parse error:", e.message);
    return [];
  }
}

async function espnRoster(teamId, teamAbbr, teamName) {
  // Use numeric team ID — slug-based URLs return 400
  var url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/" + teamId + "/roster";
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    console.warn("[ESPN] Roster team", teamId, "("+teamAbbr+") returned HTTP", r.status);
    return [];
  }
  try {
    var d = JSON.parse(r.body);
    var athletes = d.athletes || [];
    return athletes.map(function(a) {
      return {
        id:       "espn-" + a.id,
        name:     a.displayName || ((a.firstName || "") + " " + (a.lastName || "")).trim(),
        team:     teamAbbr,
        teamFull: teamName,
        position: (a.position && a.position.abbreviation) || "G",
        jersey:   a.jersey || "",
        cost:     1, // overwritten by assignCosts
      };
    });
  } catch (e) {
    console.warn("[ESPN] Roster parse error:", slug, e.message);
    return [];
  }
}

async function generateFromESPN(today, tomorrow) {
  console.log("[ESPN] Fetching today schedule:", dateStr(today));
  var todayGames = await espnSchedule(espnDateStr(today));
  console.log("[ESPN] Today games:", todayGames.length);

  console.log("[ESPN] Fetching tomorrow schedule:", dateStr(tomorrow));
  var tmrwGames  = await espnSchedule(espnDateStr(tomorrow));
  console.log("[ESPN] Tomorrow games:", tmrwGames.length);

  if (todayGames.length === 0 && tmrwGames.length === 0) {
    console.warn("[ESPN] No games found for either day");
    return null;
  }

  var allPools  = [];
  var playerMap = {};
  var days = [
    { games: todayGames, tag: "today", date: today },
    { games: tmrwGames,  tag: "tmrw",  date: tomorrow },
  ];

  for (var di = 0; di < days.length; di++) {
    var day = days[di];
    for (var gi = 0; gi < day.games.length; gi++) {
      var g   = day.games[gi];
      var pid = poolId(g.homeTeam.abbr, g.awayTeam.abbr, day.tag);
      var lockAt = g.datetime || new Date(day.date.getTime() + 23 * 3600000).toISOString();

      allPools.push({
        id:        pid,
        label:     g.homeTeam.abbr + " vs " + g.awayTeam.abbr,
        title:     g.homeTeam.name + " vs " + g.awayTeam.name,
        homeTeam:  g.homeTeam,
        awayTeam:  g.awayTeam,
        lockAt:    lockAt,
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       day.tag,
        source:    "espn",
      });

      console.log("[ESPN] Fetching home roster:", g.homeTeam.abbr, "(id:", g.homeTeam.id + ")");
      var homePlayers = await espnRoster(g.homeTeam.id, g.homeTeam.abbr, g.homeTeam.name);
      console.log("[ESPN]  ->", homePlayers.length, "players");

      console.log("[ESPN] Fetching away roster:", g.awayTeam.abbr, "(id:", g.awayTeam.id + ")");
      var awayPlayers = await espnRoster(g.awayTeam.id, g.awayTeam.abbr, g.awayTeam.name);
      console.log("[ESPN]  ->", awayPlayers.length, "players");

      var homeWithCost = assignCosts(homePlayers);
      var awayWithCost = assignCosts(awayPlayers);
      var combined = pickPlayers(homeWithCost, MAX_PER_TEAM, MIN_PER_TEAM)
                     .concat(pickPlayers(awayWithCost, MAX_PER_TEAM, MIN_PER_TEAM));

      if (combined.length >= 10) {
        playerMap[pid] = combined;
      } else {
        console.warn("[ESPN] Not enough players for pool:", pid, "(got:", combined.length + ")");
      }
    }
  }

  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "espn" };
}

// ── Sportradar Source ─────────────────────────────────────────────────────────

var SR_BASE = "https://api.sportradar.com/nba/" + SR_LEVEL + "/v8/en";

async function srGet(urlPath) {
  var url = SR_BASE + urlPath + "?api_key=" + SR_KEY;
  var r = await fetchWithRetry(url);
  if (r.status === 429) throw new Error("SR 429 rate limit");
  if (r.status !== 200) throw new Error("SR HTTP " + r.status + " for " + urlPath);
  return JSON.parse(r.body);
}

function srMapPlayer(p, teamAbbr, teamFull) {
  var name = ((p.full_name || ((p.first_name || "") + " " + (p.last_name || "")).trim()) || "Unknown");
  return {
    id:       "sr-" + (p.id || p.sr_id || name.replace(/\s+/g, "-").toLowerCase()),
    name:     name,
    team:     teamAbbr,
    teamFull: teamFull,
    position: p.primary_position || p.position || "G",
    jersey:   p.jersey_number || "",
    cost:     1, // overwritten by assignCosts
  };
}

async function generateFromSportradar(today, tomorrow) {
  if (!SR_KEY) throw new Error("SPORTRADAR_API_KEY not set");

  var allPools  = [];
  var playerMap = {};
  var days = [
    { date: today,    tag: "today" },
    { date: tomorrow, tag: "tmrw"  },
  ];

  for (var di = 0; di < days.length; di++) {
    var day = days[di];
    var ds  = dateStr(day.date).replace(/-/g, "/");
    console.log("[SR] Fetching schedule:", ds);
    var sched = await srGet("/games/" + ds + "/schedule.json");
    var games = (sched.games || []).filter(function(g) {
      return !g.status || g.status === "scheduled" || g.status === "created";
    });
    console.log("[SR] Games:", games.length);

    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi];
      var homeAbbr = ((g.home && (g.home.alias || g.home.abbr)) || "HOM").toUpperCase();
      var awayAbbr = ((g.away && (g.away.alias || g.away.abbr)) || "AWY").toUpperCase();
      var homeName = (g.home && g.home.market ? g.home.market + " " + g.home.name : homeAbbr) || homeAbbr;
      var awayName = (g.away && g.away.market ? g.away.market + " " + g.away.name : awayAbbr) || awayAbbr;
      var homeId   = g.home && g.home.id;
      var awayId   = g.away && g.away.id;
      var pid      = poolId(homeAbbr, awayAbbr, day.tag);

      allPools.push({
        id:        pid,
        label:     homeAbbr + " vs " + awayAbbr,
        title:     homeName + " vs " + awayName,
        homeTeam:  { id: homeId, abbr: homeAbbr, name: homeName },
        awayTeam:  { id: awayId, abbr: awayAbbr, name: awayName },
        lockAt:    g.scheduled || new Date(day.date.getTime() + 23 * 3600000).toISOString(),
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       day.tag,
        source:    "sportradar",
      });

      var homePlayers = [], awayPlayers = [];
      try {
        console.log("[SR] Fetching home roster:", homeAbbr);
        var homeProfile = await srGet("/teams/" + homeId + "/profile.json");
        homePlayers = (homeProfile.players || []).map(function(p) { return srMapPlayer(p, homeAbbr, homeName); });
      } catch (e) {
        console.warn("[SR] Home roster failed:", e.message);
        if (e.message.indexOf("429") !== -1) throw e;
      }
      try {
        console.log("[SR] Fetching away roster:", awayAbbr);
        var awayProfile = await srGet("/teams/" + awayId + "/profile.json");
        awayPlayers = (awayProfile.players || []).map(function(p) { return srMapPlayer(p, awayAbbr, awayName); });
      } catch (e) {
        console.warn("[SR] Away roster failed:", e.message);
        if (e.message.indexOf("429") !== -1) throw e;
      }

      var homeWithCost = assignCosts(homePlayers);
      var awayWithCost = assignCosts(awayPlayers);
      var combined = pickPlayers(homeWithCost, MAX_PER_TEAM, MIN_PER_TEAM)
                     .concat(pickPlayers(awayWithCost, MAX_PER_TEAM, MIN_PER_TEAM));
      if (combined.length >= 10) playerMap[pid] = combined;
    }
  }

  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "sportradar" };
}

// ── BallDontLie schedule + ESPN rosters ──────────────────────────────────────

async function bdlGet(urlPath) {
  var url = "https://api.balldontlie.io/v1" + urlPath;
  var headers = {};
  if (BDL_KEY) headers["Authorization"] = BDL_KEY;
  var r = await fetchWithRetry(url, headers);
  if (r.status === 401) throw new Error("BDL 401 Unauthorized");
  if (r.status === 429) throw new Error("BDL 429 rate limit");
  if (r.status !== 200) throw new Error("BDL HTTP " + r.status + " for " + urlPath);
  return JSON.parse(r.body);
}

async function generateFromBDL(today, tomorrow) {
  var allPools  = [];
  var playerMap = {};
  var days = [
    { date: today,    tag: "today" },
    { date: tomorrow, tag: "tmrw"  },
  ];

  for (var di = 0; di < days.length; di++) {
    var day = days[di];
    var ds  = dateStr(day.date);
    console.log("[BDL] Fetching schedule:", ds);
    var sched = await bdlGet("/games?dates[]=" + ds + "&per_page=20");
    var games = sched.data || [];
    console.log("[BDL] Games:", games.length);

    for (var gi = 0; gi < games.length; gi++) {
      var g        = games[gi];
      var homeAbbr = normAbbr((g.home_team && g.home_team.abbreviation) || "HOM");
      var awayAbbr = normAbbr((g.visitor_team && g.visitor_team.abbreviation) || "AWY");
      var homeName = (g.home_team && g.home_team.full_name) || homeAbbr;
      var awayName = (g.visitor_team && g.visitor_team.full_name) || awayAbbr;
      var homeEspnId = ESPN_ID_BY_ABBR[homeAbbr];
      var awayEspnId = ESPN_ID_BY_ABBR[awayAbbr];
      var pid = poolId(homeAbbr, awayAbbr, day.tag);

      allPools.push({
        id:        pid,
        label:     homeAbbr + " vs " + awayAbbr,
        title:     homeName + " vs " + awayName,
        homeTeam:  { id: homeEspnId, abbr: homeAbbr, name: homeName },
        awayTeam:  { id: awayEspnId, abbr: awayAbbr, name: awayName },
        lockAt:    g.datetime || new Date(day.date.getTime() + 23 * 3600000).toISOString(),
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       day.tag,
        source:    "bdl+espn",
      });

      var homePlayers = [], awayPlayers = [];
      if (homeEspnId) {
        console.log("[BDL+ESPN] Fetching home roster:", homeAbbr, "(ESPN id:", homeEspnId + ")");
        homePlayers = await espnRoster(homeEspnId, homeAbbr, homeName);
        console.log("[BDL+ESPN]  ->", homePlayers.length, "players");
      }
      if (awayEspnId) {
        console.log("[BDL+ESPN] Fetching away roster:", awayAbbr, "(ESPN id:", awayEspnId + ")");
        awayPlayers = await espnRoster(awayEspnId, awayAbbr, awayName);
        console.log("[BDL+ESPN]  ->", awayPlayers.length, "players");
      }

      var homeWithCost = assignCosts(homePlayers);
      var awayWithCost = assignCosts(awayPlayers);
      var combined = pickPlayers(homeWithCost, MAX_PER_TEAM, MIN_PER_TEAM)
                     .concat(pickPlayers(awayWithCost, MAX_PER_TEAM, MIN_PER_TEAM));
      if (combined.length >= 10) playerMap[pid] = combined;
    }
  }

  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "bdl+espn" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  var now      = new Date();
  var todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  var tmrwUTC  = new Date(todayUTC.getTime() + 86400000);

  console.log("[gen] ============================================================");
  console.log("[gen] SH Fantasy Snapshot Generator v2.1");
  console.log("[gen] Started:", nowISO());
  console.log("[gen] Today (UTC):", dateStr(todayUTC), "| Tomorrow (UTC):", dateStr(tmrwUTC));
  console.log("[gen] Sportradar key:", SR_KEY ? "SET (" + SR_KEY.slice(0,8) + "...)" : "NOT SET");
  console.log("[gen] BallDontLie key:", BDL_KEY ? "SET (" + BDL_KEY.slice(0,8) + "...)" : "NOT SET");
  console.log("[gen] ============================================================");

  var result = null;

  // ── Source 1: Sportradar ──────────────────────────────────────────────────
  if (SR_KEY) {
    console.log("\n[gen] Trying Source 1: Sportradar...");
    try {
      result = await generateFromSportradar(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] Sportradar: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] Sportradar: 0 pools, trying fallback");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] Sportradar FAILED:", e.message);
      result = null;
    }
  } else {
    console.log("[gen] Skipping Sportradar (no API key)");
  }

  // ── Source 2: ESPN ────────────────────────────────────────────────────────
  if (!result) {
    console.log("\n[gen] Trying Source 2: ESPN (free, current rosters)...");
    try {
      result = await generateFromESPN(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] ESPN: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] ESPN: 0 pools, trying fallback");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] ESPN FAILED:", e.message);
      result = null;
    }
  }

  // ── Source 3: BallDontLie schedule + ESPN rosters ────────────────────────
  if (!result) {
    console.log("\n[gen] Trying Source 3: BallDontLie schedule + ESPN rosters...");
    try {
      result = await generateFromBDL(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] BDL+ESPN: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] BDL+ESPN: 0 pools");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] BDL+ESPN FAILED:", e.message);
      result = null;
    }
  }

  // ── Source 4: Preserve existing snapshots ────────────────────────────────
  if (!result || result.pools.length === 0) {
    console.warn("\n[gen] All sources failed — existing snapshots preserved (not overwritten)");
    console.warn("[gen] Check network connectivity and API keys, then retry.");
    process.exit(0);
  }

  // ── Write pools.snapshot.json ─────────────────────────────────────────────
  var poolsFile = path.join(SNAP_DIR, "pools.snapshot.json");
  var poolsData = {
    dataMode:    "SNAPSHOT",
    source:      result.source,
    generatedAt: nowISO(),
    updatedAt:   nowISO(),
    pools:       result.pools,
  };
  safeWrite(poolsFile, poolsData);

  // ── Write players.<poolId>.json ───────────────────────────────────────────
  var writtenCount = 0;
  result.pools.forEach(function(pool) {
    var players = result.playerMap[pool.id];
    if (!players || players.length === 0) {
      console.warn("[gen] No players for pool:", pool.id, "— skipping");
      return;
    }
    var pFile = path.join(SNAP_DIR, "players." + pool.id + ".json");
    safeWrite(pFile, players);
    writtenCount++;
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n[gen] ============================================================");
  console.log("[gen] DONE. Source:", result.source);
  console.log("[gen] Pools:", result.pools.length, "| Player files written:", writtenCount);
  console.log("[gen] Pool IDs:");
  result.pools.forEach(function(p) {
    var cnt = (result.playerMap[p.id] || []).length;
    console.log("[gen]   ", p.id, "|", p.title, "| players:", cnt);
  });

  // ── Quick smoke test ──────────────────────────────────────────────────────
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
      console.log("[gen] First 5 players:");
      pp.slice(0, 5).forEach(function(p) {
        console.log("[gen]   ", p.name, "(" + p.team + ", $" + p.cost + ", " + p.position + ")");
      });
    }
  }

  // ── Roster correctness checks ─────────────────────────────────────────────
  console.log("\n[gen] === Roster Correctness Check ===");
  var foundCurry = false, foundAD = false, foundDoncic = false;
  result.pools.forEach(function(pool) {
    var players = result.playerMap[pool.id] || [];
    players.forEach(function(p) {
      if (p.name === "Stephen Curry") {
        console.log("[gen] Stephen Curry: team=" + p.team + " (expected: GSW) pool=" + pool.id);
        if (p.team !== "GSW") console.warn("[gen] WARNING: Stephen Curry team mismatch! Got:", p.team);
        foundCurry = true;
      }
      if (p.name === "Anthony Davis") {
        console.log("[gen] Anthony Davis: team=" + p.team + " pool=" + pool.id);
        if (p.team === "LAL") console.warn("[gen] WARNING: Anthony Davis still showing LAL — check roster source");
        foundAD = true;
      }
      if (p.name === "Luka Doncic") {
        console.log("[gen] Luka Doncic: team=" + p.team + " pool=" + pool.id);
        foundDoncic = true;
      }
      if (p.name === "LeBron James") {
        console.log("[gen] LeBron James: team=" + p.team + " pool=" + pool.id);
      }
    });
  });
  if (!foundCurry)  console.log("[gen] (Stephen Curry not in any pool today/tomorrow)");
  if (!foundAD)     console.log("[gen] (Anthony Davis not in any pool today/tomorrow)");
  if (!foundDoncic) console.log("[gen] (Luka Doncic not in any pool today/tomorrow)");
  console.log("[gen] ============================================================");
}

main().catch(function(e) {
  console.error("[gen] Fatal:", e.message || e);
  process.exit(1);
});
