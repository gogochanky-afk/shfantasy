#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js  v3.1
 * ─────────────────────────────────────────────────────────────────────────────
 * DK-style Salary Engine: Projection → Salary
 *
 * Pipeline:
 *   1. ESPN schedule (today + tomorrow)
 *   2. ESPN roster + injury status per team
 *   3. ESPN gamelog (last 5 games) → avgMin, avgPts, avgReb, avgAst per player
 *   4. proj = minProj × ppm  (with fallbacks + injury adjustment)
 *   5. DK-style salary mapping by proj:
 *        top 12%  → $4
 *        12–40%   → $3
 *        40–70%   → $2
 *        70–100%  → $1
 *      + Star floor: each team top-2 by proj ≥ $3; pool top-3 forced to $4
 *      + Per-team cap: max 2 players at $4 per team
 *   6. value = proj / cost (2dp)
 *
 * Source priority:
 *   1. Sportradar (if SPORTRADAR_API_KEY set)
 *   2. ESPN public API (no key required) ← primary free path
 *   3. BallDontLie schedule + ESPN rosters
 *   4. Preserve existing snapshots (no overwrite on total failure)
 *
 * Throttling: serial + 1200ms gap; 429 → backoff 2s→4s→8s→16s→20s, max 5 retries
 *
 * Runtime invariant: 0 external fetch in routes/lib — only reads data/snapshots/*.json
 *
 * Usage:
 *   node scripts/generateSnapshots.js
 *   SPORTRADAR_API_KEY=xxx node scripts/generateSnapshots.js
 *   node scripts/generateSnapshots.js --include-inactive
 */

var https = require("https");
var fs    = require("fs");
var path  = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
var SR_KEY         = process.env.SPORTRADAR_API_KEY          || "";
var SR_LEVEL       = process.env.SPORTRADAR_NBA_ACCESS_LEVEL || "trial";
var BDL_KEY        = process.env.BALLDONTLIE_API_KEY         || "";
var THROTTLE_MS    = 1200;
var MAX_RETRIES    = 5;
var MAX_BACKOFF_MS = 20000;
var ROSTER_SIZE    = 5;
var SALARY_CAP     = 10;
var MAX_PER_TEAM   = 9;   // rotation limit per team
var MIN_PER_TEAM   = 7;   // minimum per team before relaxing
var MIN_TOTAL      = 14;  // minimum total players per pool
var GAMELOG_GAMES  = 5;   // how many recent games to average for proj

// DK-style salary tier thresholds (applied pool-wide)
var DK_TIER4_PCT   = 0.12;  // top 12%  → $4
var DK_TIER3_PCT   = 0.40;  // top 40%  → $3 (12%+28%)
var DK_TIER2_PCT   = 0.70;  // top 70%  → $2 (12%+28%+30%)
// rest → $1

// Star floor
var STAR_FLOOR_TEAM_TOP = 2;   // each team's top-N by proj → minCost $3
var STAR_FLOOR_POOL_TOP = 3;   // pool's top-N by proj → forced $4

// Per-team cap
var MAX_COST4_PER_TEAM = 2;    // max 2 players at $4 per team

// Fallback proj components (when no gamelog available)
// Role determined by ESPN roster depth (index 0-4 = starter, 5-8 = rotation, 9+ = bench)
var FALLBACK_MIN = { starter: 30, rotation: 24, bench: 16, deep: 10 };
var FALLBACK_PPM = { star: 1.25, starter: 1.05, rotation: 0.90, bench: 0.75 };

// Injury adjustment multipliers for minProj
var INJ_ADJ = { active: 1.0, questionable: 0.85, doubtful: 0.60, out: 0, inactive: 0, unknown: 0.85 };

// CLI flag
var INCLUDE_INACTIVE = process.argv.indexOf("--include-inactive") !== -1;

// ESPN abbreviation normalisation
var ESPN_ABBR_FIX = {
  "GS":   "GSW",
  "NY":   "NYK",
  "SA":   "SAS",
  "NO":   "NOP",
  "UTAH": "UTA",
  "WSH":  "WAS",
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
function normAbbr(abbr) { return ESPN_ABBR_FIX[abbr] || abbr; }
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

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
      "User-Agent": "SHFantasy-SnapshotGen/3.1 (compatible)",
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

// ── Player Status Model ───────────────────────────────────────────────────────
function normaliseInjuryStatus(espnInjuryStatus) {
  if (!espnInjuryStatus) return "active";
  var s = String(espnInjuryStatus).toLowerCase().trim();
  if (s === "out")                                return "out";
  if (s === "inactive" || s === "suspended")      return "inactive";
  if (s === "doubtful")                           return "doubtful";
  if (s === "day-to-day" || s === "questionable") return "questionable";
  if (s === "probable")                           return "questionable";
  return "unknown";
}
function isPlayable(injuryStatus) {
  return injuryStatus !== "out" && injuryStatus !== "inactive";
}

// ── ESPN Gamelog Stats ────────────────────────────────────────────────────────
/**
 * Fetch last GAMELOG_GAMES games from ESPN athlete gamelog.
 * Returns { avgMin, avgPts, avgReb, avgAst } or null if unavailable.
 *
 * ESPN gamelog labels: ['MIN','FG','FG%','3PT','3P%','FT','FT%','REB','AST','BLK','STL','PF','TO','PTS']
 * Index:                  0     1    2     3     4     5    6     7     8     9     10    11   12   13
 */
var _gamelogCache = {};  // espnAthleteId → stats object
async function espnGamelog(espnAthleteId) {
  if (_gamelogCache[espnAthleteId] !== undefined) return _gamelogCache[espnAthleteId];
  var url = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/" +
            espnAthleteId + "/gamelog?season=2025";
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    _gamelogCache[espnAthleteId] = null;
    return null;
  }
  try {
    var d = JSON.parse(r.body);
    // labels are at top level
    var labels = d.labels || [];
    var minIdx = labels.indexOf("MIN");
    var ptsIdx = labels.indexOf("PTS");
    var rebIdx = labels.indexOf("REB");
    var astIdx = labels.indexOf("AST");
    if (minIdx === -1 || ptsIdx === -1) {
      _gamelogCache[espnAthleteId] = null;
      return null;
    }
    // Collect stats from seasonTypes[0].categories[0].events (most recent first)
    var allStats = [];
    var sts = d.seasonTypes || [];
    for (var si = 0; si < sts.length && allStats.length < GAMELOG_GAMES; si++) {
      var cats = sts[si].categories || [];
      for (var ci = 0; ci < cats.length && allStats.length < GAMELOG_GAMES; ci++) {
        var events = cats[ci].events || [];
        for (var ei = 0; ei < events.length && allStats.length < GAMELOG_GAMES; ei++) {
          var stats = events[ei].stats || [];
          if (stats.length === 0) continue;
          var minVal = parseFloat(stats[minIdx]);
          var ptsVal = parseFloat(stats[ptsIdx]);
          var rebVal = rebIdx !== -1 ? parseFloat(stats[rebIdx]) : 0;
          var astVal = astIdx !== -1 ? parseFloat(stats[astIdx]) : 0;
          if (!isNaN(minVal) && minVal > 0) {
            allStats.push({ min: minVal, pts: ptsVal || 0, reb: rebVal || 0, ast: astVal || 0 });
          }
        }
      }
    }
    if (allStats.length === 0) {
      _gamelogCache[espnAthleteId] = null;
      return null;
    }
    var n = allStats.length;
    var result = {
      avgMin: round1(allStats.reduce(function(s,g){return s+g.min;},0) / n),
      avgPts: round1(allStats.reduce(function(s,g){return s+g.pts;},0) / n),
      avgReb: round1(allStats.reduce(function(s,g){return s+g.reb;},0) / n),
      avgAst: round1(allStats.reduce(function(s,g){return s+g.ast;},0) / n),
      gamesUsed: n,
    };
    _gamelogCache[espnAthleteId] = result;
    return result;
  } catch (e) {
    _gamelogCache[espnAthleteId] = null;
    return null;
  }
}

// ── Projection Engine ─────────────────────────────────────────────────────────
/**
 * Determine player role from roster depth index.
 * ESPN roster order ≈ depth chart (0 = first listed = likely starter).
 */
function roleFromDepth(rosterIdx) {
  if (rosterIdx < 5)  return "starter";
  if (rosterIdx < 9)  return "rotation";
  if (rosterIdx < 13) return "bench";
  return "deep";
}

/**
 * Compute fantasy points per minute (ppm) from game stats.
 * DK scoring: PTS=1, REB=1.25, AST=1.5, STL=2, BLK=2, TO=-0.5
 * We approximate with: PTS + 1.25*REB + 1.5*AST (no STL/BLK/TO in gamelog)
 */
function computePPM(avgPts, avgReb, avgAst, avgMin) {
  if (!avgMin || avgMin <= 0) return null;
  var fp = avgPts + 1.25 * avgReb + 1.5 * avgAst;
  return round2(fp / avgMin);
}

/**
 * Compute projection for a player.
 * Returns { proj, projSource, avgMin, avgPts, avgReb, avgAst, ppm }
 */
function computeProj(player, stats) {
  var role = roleFromDepth(player._rosterIdx || 0);
  var injAdj = INJ_ADJ[player.injuryStatus] != null ? INJ_ADJ[player.injuryStatus] : 1.0;

  if (stats && stats.avgMin > 0) {
    // Stats-based projection
    var ppm = computePPM(stats.avgPts, stats.avgReb, stats.avgAst, stats.avgMin);
    if (ppm && ppm > 0) {
      var minProj = stats.avgMin * injAdj;
      var proj = round1(minProj * ppm);
      return {
        proj:       proj,
        projSource: "gamelog",
        avgMin:     stats.avgMin,
        avgPts:     stats.avgPts,
        avgReb:     stats.avgReb,
        avgAst:     stats.avgAst,
        ppm:        ppm,
        gamesUsed:  stats.gamesUsed,
      };
    }
  }

  // Fallback: depth-based
  var fallbackMin = FALLBACK_MIN[role] || FALLBACK_MIN.bench;
  // Determine ppm role: starters with high depth = star, else by role
  var ppmRole = (role === "starter" && (player._rosterIdx || 0) < 2) ? "star" : role;
  if (ppmRole === "deep") ppmRole = "bench";
  var fallbackPPM = FALLBACK_PPM[ppmRole] || FALLBACK_PPM.bench;
  var minProj2 = fallbackMin * injAdj;
  var proj2 = round1(minProj2 * fallbackPPM);
  return {
    proj:       proj2,
    projSource: "fallback",
    avgMin:     null,
    avgPts:     null,
    avgReb:     null,
    avgAst:     null,
    ppm:        fallbackPPM,
    gamesUsed:  0,
  };
}

// ── DK-style Salary Assignment ────────────────────────────────────────────────
/**
 * Assign cost tiers pool-wide using DK-style proj-based mapping.
 *
 * Step 1: Sort all players by proj DESC.
 * Step 2: Raw tier by percentile:
 *   top DK_TIER4_PCT → $4
 *   top DK_TIER3_PCT → $3
 *   top DK_TIER2_PCT → $2
 *   rest             → $1
 * Step 3: Star floor:
 *   - Each team's top STAR_FLOOR_TEAM_TOP players by proj → minCost $3
 *   - Pool's top STAR_FLOOR_POOL_TOP players by proj → forced $4
 * Step 4: Per-team cap:
 *   - max MAX_COST4_PER_TEAM players at $4 per team (excess → $3)
 * Step 5: Clamp 1–4.
 */
function assignDKCosts(players) {
  if (!players || players.length === 0) return players;
  var n = players.length;

  // Sort by proj DESC for tier assignment
  var sorted = players.slice().sort(function(a, b) {
    var pa = a.proj || 0, pb = b.proj || 0;
    if (pb !== pa) return pb - pa;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Step 2: raw tier by percentile
  var t4 = Math.max(1, Math.round(n * DK_TIER4_PCT));
  var t3 = Math.max(1, Math.round(n * DK_TIER3_PCT));
  var t2 = Math.max(1, Math.round(n * DK_TIER2_PCT));
  var costMap = {};
  sorted.forEach(function(p, i) {
    if (i < t4)      costMap[p.id] = 4;
    else if (i < t3) costMap[p.id] = 3;
    else if (i < t2) costMap[p.id] = 2;
    else             costMap[p.id] = 1;
  });

  // Step 3a: Star floor — each team top-2 by proj → minCost $3
  var byTeam = {};
  players.forEach(function(p) {
    if (!byTeam[p.team]) byTeam[p.team] = [];
    byTeam[p.team].push(p);
  });
  Object.keys(byTeam).forEach(function(team) {
    var tp = byTeam[team].slice().sort(function(a, b) { return (b.proj||0) - (a.proj||0); });
    tp.slice(0, STAR_FLOOR_TEAM_TOP).forEach(function(p) {
      if (costMap[p.id] < 3) costMap[p.id] = 3;
    });
  });

  // Step 3b: Star floor — pool top-3 by proj → forced $4
  sorted.slice(0, STAR_FLOOR_POOL_TOP).forEach(function(p) {
    costMap[p.id] = 4;
  });

  // Step 4: per-team cap — max 2 at $4 per team (excess → $3)
  Object.keys(byTeam).forEach(function(team) {
    var tp = byTeam[team].slice().sort(function(a, b) {
      var ca = costMap[a.id]||1, cb = costMap[b.id]||1;
      if (cb !== ca) return cb - ca;
      return (b.proj||0) - (a.proj||0);
    });
    var count4 = 0;
    tp.forEach(function(p) {
      if ((costMap[p.id]||1) === 4) {
        count4++;
        if (count4 > MAX_COST4_PER_TEAM) {
          costMap[p.id] = 3;
          count4 = MAX_COST4_PER_TEAM;
        }
      }
    });
  });

  // Step 5: clamp + compute value
  return players.map(function(p) {
    var c = Math.min(4, Math.max(1, costMap[p.id] || 1));
    var v = round2((p.proj || 0) / c);
    return Object.assign({}, p, { cost: c, value: v });
  });
}

// ── ESPN Team Statistics (batch: 1 call per team) ────────────────────────────
/**
 * Fetch season averages for all players on a team in ONE API call.
 * Uses ESPN team athletes/statistics endpoint.
 * Returns map: espnAthleteId → { avgMin, avgPts, avgReb, avgAst }
 */
var _teamStatsCache = {}; // teamId → statsMap
async function espnTeamStats(teamId) {
  if (_teamStatsCache[teamId] !== undefined) return _teamStatsCache[teamId];
  var url = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/" +
            teamId + "/athletes/statistics";
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    console.warn("[stats] Team stats HTTP", r.status, "for team", teamId);
    _teamStatsCache[teamId] = {};
    return {};
  }
  try {
    var d = JSON.parse(r.body);
    var results = d.results || {};
    var splits = Object.values(results);
    var gameSplit = splits.find(function(s) { return s.name === "game"; });
    if (!gameSplit || !gameSplit.leaders) {
      _teamStatsCache[teamId] = {};
      return {};
    }
    var statsMap = {};
    gameSplit.leaders.forEach(function(leader) {
      var athleteId = leader.athlete && String(leader.athlete.id);
      if (!athleteId) return;
      if (!statsMap[athleteId]) statsMap[athleteId] = { avgMin: 0, avgPts: 0, avgReb: 0, avgAst: 0 };
      var cats = leader.statistics || [];
      cats.forEach(function(cat) {
        if (cat.name === "general") {
          cat.stats.forEach(function(s) {
            if (s.name === "avgRebounds") statsMap[athleteId].avgReb = round1(s.value || 0);
            if (s.name === "avgMinutes")  statsMap[athleteId].avgMin = round1(s.value || 0);
          });
        }
        if (cat.name === "offensive") {
          cat.stats.forEach(function(s) {
            if (s.name === "avgPoints")  statsMap[athleteId].avgPts = round1(s.value || 0);
            if (s.name === "avgAssists") statsMap[athleteId].avgAst = round1(s.value || 0);
          });
        }
      });
    });
    // Filter to players with actual stats
    Object.keys(statsMap).forEach(function(id) {
      var s = statsMap[id];
      if (s.avgMin <= 0 && s.avgPts <= 0) delete statsMap[id];
      else s.gamesUsed = 5; // season average approximation
    });
    console.log("[stats] Team", teamId, "→", Object.keys(statsMap).length, "players with stats (1 call)");
    _teamStatsCache[teamId] = statsMap;
    return statsMap;
  } catch (e) {
    console.warn("[stats] Team stats parse error:", e.message);
    _teamStatsCache[teamId] = {};
    return {};
  }
}

/**
 * Fetch stats for a team's players using batch endpoint.
 * Falls back to per-player gamelog if batch fails.
 */
async function fetchTeamStatsBatch(players, teamId) {
  var statsMap = {};
  if (teamId) {
    statsMap = await espnTeamStats(teamId);
  }
  // Log coverage
  var playable = players.filter(function(p) { return p.isPlayable; });
  playable.forEach(function(p) {
    var espnId = p._espnId;
    if (statsMap[espnId]) {
      var s = statsMap[espnId];
      console.log("[stats]  " + p.name + " (" + p.team + "): " +
        s.avgMin + "min " + s.avgPts + "pts " + s.avgReb + "reb " + s.avgAst + "ast");
    } else {
      console.log("[stats]  " + p.name + " (" + p.team + "): no stats → fallback");
    }
  });
  return statsMap;
}

// ── Rotation filter + proj enrichment ────────────────────────────────────────
/**
 * Filter to playable players, apply rotation limit, enrich with proj.
 * stats: map of espnAthleteId → { avgMin, avgPts, avgReb, avgAst }
 */
function buildTeamPlayers(rawPlayers, max, min, statsMap) {
  // Enrich with proj
  var enriched = rawPlayers.map(function(p) {
    var espnId = p.id.replace("espn-", "");
    var stats = (statsMap && statsMap[espnId]) || null;
    var projData = computeProj(p, stats);
    return Object.assign({}, p, projData);
  });

  if (INCLUDE_INACTIVE) {
    return enriched.slice(0, max);
  }
  // Playable filter
  var playable = enriched.filter(function(p) { return p.isPlayable; });
  // Rotation limit
  var result = playable.length <= max ? playable : playable.slice(0, max);
  // Relax if too few
  if (result.length < min) {
    var outPlayers = enriched.filter(function(p) { return p.injuryStatus === "out"; });
    result = result.concat(outPlayers.slice(0, min - result.length));
  }
  return result;
}

/**
 * Build pool players from home + away rosters.
 * statsMap: { espnAthleteId → gamelog stats }
 */
function buildPoolPlayers(homePlayers, awayPlayers, homeName, awayName, statsMap) {
  var homeFiltered = buildTeamPlayers(homePlayers, MAX_PER_TEAM, MIN_PER_TEAM, statsMap);
  var awayFiltered = buildTeamPlayers(awayPlayers, MAX_PER_TEAM, MIN_PER_TEAM, statsMap);
  var combined = homeFiltered.concat(awayFiltered);
  if (combined.length < MIN_TOTAL) {
    console.warn("[gen] Not enough playable players (got:", combined.length + ") — using full roster");
    var homeAll = buildTeamPlayers(homePlayers, MAX_PER_TEAM, MIN_PER_TEAM, statsMap);
    var awayAll = buildTeamPlayers(awayPlayers, MAX_PER_TEAM, MIN_PER_TEAM, statsMap);
    combined = homeAll.concat(awayAll);
  }
  // Assign DK-style costs
  return assignDKCosts(combined);
}

// ── ESPN Source ───────────────────────────────────────────────────────────────
async function espnSchedule(dateYYYYMMDD) {
  var url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=" + dateYYYYMMDD;
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    console.warn("[ESPN] Schedule HTTP", r.status, "for", dateYYYYMMDD);
    return [];
  }
  try {
    var d = JSON.parse(r.body);
    var events = d.events || [];
    return events.map(function(ev) {
      var comps = ev.competitions && ev.competitions[0];
      var competitors = (comps && comps.competitors) || [];
      var home = competitors.find(function(c) { return c.homeAway === "home"; }) || competitors[0] || {};
      var away = competitors.find(function(c) { return c.homeAway === "away"; }) || competitors[1] || {};
      var homeAbbr = normAbbr((home.team && home.team.abbreviation) || "HOM");
      var awayAbbr = normAbbr((away.team && away.team.abbreviation) || "AWY");
      return {
        homeTeam: {
          id:   String((home.team && home.team.id) || ""),
          abbr: homeAbbr,
          name: (home.team && home.team.displayName) || homeAbbr,
        },
        awayTeam: {
          id:   String((away.team && away.team.id) || ""),
          abbr: awayAbbr,
          name: (away.team && away.team.displayName) || awayAbbr,
        },
        datetime: (comps && comps.date) || null,
      };
    });
  } catch (e) {
    console.warn("[ESPN] Schedule parse error:", e.message);
    return [];
  }
}

async function espnRoster(teamId, teamAbbr, teamFull) {
  var url = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/" + teamId + "/roster";
  var r = await fetchWithRetry(url);
  if (r.status !== 200) {
    console.warn("[ESPN] Roster HTTP", r.status, "for team", teamId, teamAbbr);
    return [];
  }
  try {
    var d = JSON.parse(r.body);
    var athletes = d.athletes || [];
    return athletes.map(function(a, idx) {
      var injRaw  = (a.injuries && a.injuries.length > 0) ? a.injuries[0].status : null;
      var injNote = (a.injuries && a.injuries.length > 0) ? a.injuries[0].longComment : null;
      var injStatus = normaliseInjuryStatus(injRaw);
      var playable  = isPlayable(injStatus);
      return {
        id:           "espn-" + (a.id || (teamAbbr + "-" + idx)),
        _espnId:      String(a.id || ""),
        name:         a.displayName || a.fullName || "Unknown",
        team:         teamAbbr,
        teamFull:     teamFull,
        position:     (a.position && a.position.abbreviation) || "G",
        jersey:       a.jersey || "",
        cost:         1,
        proj:         0,
        value:        0,
        injuryStatus: injStatus,
        injuryNote:   injNote || null,
        isPlayable:   playable,
        _rosterIdx:   idx,
      };
    });
  } catch (e) {
    console.warn("[ESPN] Roster parse error:", e.message);
    return [];
  }
}

/**
 * Fetch gamelog stats for a list of players (serial, throttled).
 * Returns a map: espnId → { avgMin, avgPts, avgReb, avgAst, gamesUsed }
 */
async function fetchTeamStats(players) {
  var statsMap = {};
  var playable = players.filter(function(p) { return p.isPlayable && p._espnId; });
  for (var i = 0; i < playable.length; i++) {
    var p = playable[i];
    var espnId = p._espnId;
    if (!espnId) continue;
    var stats = await espnGamelog(espnId);
    if (stats) {
      statsMap[espnId] = stats;
      console.log("[stats]  " + p.name + " (" + p.team + "): " +
        stats.avgMin + "min " + stats.avgPts + "pts " + stats.avgReb + "reb " + stats.avgAst + "ast " +
        "(" + stats.gamesUsed + "g)");
    } else {
      console.log("[stats]  " + p.name + " (" + p.team + "): no gamelog → fallback");
    }
  }
  return statsMap;
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

      console.log("[ESPN] Fetching home roster:", g.homeTeam.abbr, "(id:", g.homeTeam.id + ")");
      var homePlayers = await espnRoster(g.homeTeam.id, g.homeTeam.abbr, g.homeTeam.name);
      console.log("[ESPN]  ->", homePlayers.length, "raw players (" +
        homePlayers.filter(function(p){return p.isPlayable;}).length + " playable)");

      console.log("[ESPN] Fetching away roster:", g.awayTeam.abbr, "(id:", g.awayTeam.id + ")");
      var awayPlayers = await espnRoster(g.awayTeam.id, g.awayTeam.abbr, g.awayTeam.name);
      console.log("[ESPN]  ->", awayPlayers.length, "raw players (" +
        awayPlayers.filter(function(p){return p.isPlayable;}).length + " playable)");

      // Fetch season averages for all players (batch: 1 call per team)
      console.log("[stats] Fetching team stats for", g.homeTeam.abbr, "(id:", g.homeTeam.id + ")");
      var homeStats = await fetchTeamStatsBatch(homePlayers, g.homeTeam.id);
      console.log("[stats] Fetching team stats for", g.awayTeam.abbr, "(id:", g.awayTeam.id + ")");
      var awayStats = await fetchTeamStatsBatch(awayPlayers, g.awayTeam.id);
      var statsMap = Object.assign({}, homeStats, awayStats);

      var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, g.homeTeam.name, g.awayTeam.name, statsMap);
      var outCount = (homePlayers.filter(function(p){return !p.isPlayable;}).length +
                      awayPlayers.filter(function(p){return !p.isPlayable;}).length);

      allPools.push({
        id:          pid,
        label:       g.homeTeam.abbr + " vs " + g.awayTeam.abbr,
        title:       g.homeTeam.name + " vs " + g.awayTeam.name,
        homeTeam:    g.homeTeam,
        awayTeam:    g.awayTeam,
        lockAt:      lockAt,
        rosterSize:  ROSTER_SIZE,
        salaryCap:   SALARY_CAP,
        status:      "open",
        day:         day.tag,
        source:      "espn",
        playerCount: poolPlayers.length,
        outCount:    outCount,
      });
      playerMap[pid] = poolPlayers;
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
function srMapPlayer(p, teamAbbr, teamFull, idx) {
  var name = ((p.full_name || ((p.first_name || "") + " " + (p.last_name || "")).trim()) || "Unknown");
  var espnInjStat = null;
  if (p.injury_designations && p.injury_designations.length > 0) {
    espnInjStat = p.injury_designations[0].designation || null;
  } else if (p.status && p.status.toLowerCase() === "inactive") {
    espnInjStat = "Inactive";
  }
  var injStatus = normaliseInjuryStatus(espnInjStat);
  var playable  = isPlayable(injStatus);
  return {
    id:           "sr-" + (p.id || p.sr_id || name.replace(/\s+/g, "-").toLowerCase()),
    _espnId:      "",
    name:         name,
    team:         teamAbbr,
    teamFull:     teamFull,
    position:     p.primary_position || p.position || "G",
    jersey:       p.jersey_number || "",
    cost:         1,
    proj:         0,
    value:        0,
    injuryStatus: injStatus,
    injuryNote:   null,
    isPlayable:   playable,
    _rosterIdx:   idx,
  };
}
async function generateFromSportradar(today, tomorrow) {
  var schedUrl = SR_BASE + "/games/" + dateStr(today) + "/schedule.json?api_key=" + SR_KEY;
  var schedUrl2 = SR_BASE + "/games/" + dateStr(tomorrow) + "/schedule.json?api_key=" + SR_KEY;
  var allPools  = [];
  var playerMap = {};
  var items = [
    { url: schedUrl,  tag: "today", date: today },
    { url: schedUrl2, tag: "tmrw",  date: tomorrow },
  ];
  for (var ii = 0; ii < items.length; ii++) {
    var item = items[ii];
    console.log("[SR] Fetching schedule:", dateStr(item.date));
    var schedR = await fetchWithRetry(item.url);
    if (schedR.status !== 200) {
      console.warn("[SR] Schedule HTTP", schedR.status, "for", dateStr(item.date));
      continue;
    }
    var sched = JSON.parse(schedR.body);
    var games = sched.games || [];
    console.log("[SR] Games:", games.length);
    for (var gi = 0; gi < games.length; gi++) {
      var g = games[gi];
      var homeAbbr = normAbbr((g.home && g.home.alias) || "HOM");
      var awayAbbr = normAbbr((g.away && g.away.alias) || "AWY");
      var homeName = (g.home && g.home.name) || homeAbbr;
      var awayName = (g.away && g.away.name) || awayAbbr;
      var homeId   = (g.home && g.home.id) || "";
      var awayId   = (g.away && g.away.id) || "";
      var pid = poolId(homeAbbr, awayAbbr, item.tag);
      allPools.push({
        id:        pid,
        label:     homeAbbr + " vs " + awayAbbr,
        title:     homeName + " vs " + awayName,
        homeTeam:  { id: homeId, abbr: homeAbbr, name: homeName },
        awayTeam:  { id: awayId, abbr: awayAbbr, name: awayName },
        lockAt:    g.scheduled || new Date(item.date.getTime() + 23 * 3600000).toISOString(),
        rosterSize: ROSTER_SIZE,
        salaryCap:  SALARY_CAP,
        status:    "open",
        day:       item.tag,
        source:    "sportradar",
      });
      var homePlayers = [], awayPlayers = [];
      try {
        console.log("[SR] Fetching home roster:", homeAbbr);
        var homeProfile = await srGet("/teams/" + homeId + "/profile.json");
        homePlayers = (homeProfile.players || []).map(function(p, idx) { return srMapPlayer(p, homeAbbr, homeName, idx); });
      } catch (e) {
        console.warn("[SR] Home roster failed:", e.message);
        if (e.message.indexOf("429") !== -1) throw e;
      }
      try {
        console.log("[SR] Fetching away roster:", awayAbbr);
        var awayProfile = await srGet("/teams/" + awayId + "/profile.json");
        awayPlayers = (awayProfile.players || []).map(function(p, idx) { return srMapPlayer(p, awayAbbr, awayName, idx); });
      } catch (e) {
        console.warn("[SR] Away roster failed:", e.message);
        if (e.message.indexOf("429") !== -1) throw e;
      }
      var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, homeName, awayName, {});
      var outCount = (homePlayers.filter(function(p){return !p.isPlayable;}).length +
                      awayPlayers.filter(function(p){return !p.isPlayable;}).length);
      allPools[allPools.length - 1].playerCount = poolPlayers.length;
      allPools[allPools.length - 1].outCount    = outCount;
      if (poolPlayers.length >= MIN_TOTAL) playerMap[pid] = poolPlayers;
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
      var homePlayers = [], awayPlayers = [];
      if (homeEspnId) {
        console.log("[BDL+ESPN] Fetching home roster:", homeAbbr);
        homePlayers = await espnRoster(homeEspnId, homeAbbr, homeName);
      }
      if (awayEspnId) {
        console.log("[BDL+ESPN] Fetching away roster:", awayAbbr);
        awayPlayers = await espnRoster(awayEspnId, awayAbbr, awayName);
      }
      // Fetch season averages (batch: 1 call per team)
      var homeStats = await fetchTeamStatsBatch(homePlayers, homeEspnId);
      var awayStats = await fetchTeamStatsBatch(awayPlayers, awayEspnId);
      var statsMap = Object.assign({}, homeStats, awayStats);

      var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, homeName, awayName, statsMap);
      var outCount = (homePlayers.filter(function(p){return !p.isPlayable;}).length +
                      awayPlayers.filter(function(p){return !p.isPlayable;}).length);
      allPools.push({
        id:          pid,
        label:       homeAbbr + " vs " + awayAbbr,
        title:       homeName + " vs " + awayName,
        homeTeam:    { id: homeEspnId, abbr: homeAbbr, name: homeName },
        awayTeam:    { id: awayEspnId, abbr: awayAbbr, name: awayName },
        lockAt:      g.datetime || new Date(day.date.getTime() + 23 * 3600000).toISOString(),
        rosterSize:  ROSTER_SIZE,
        salaryCap:   SALARY_CAP,
        status:      "open",
        day:         day.tag,
        source:      "bdl+espn",
        playerCount: poolPlayers.length,
        outCount:    outCount,
      });
      playerMap[pid] = poolPlayers;
    }
  }
  if (allPools.length === 0) return null;
  return { pools: allPools, playerMap: playerMap, source: "bdl+espn" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("[gen] SH Fantasy Snapshot Generator v3.0 (DK-style Salary Engine)");
  console.log("[gen] Salary mode: DK-style (proj → cost → value)");
  console.log("[gen] Proj formula: minProj × ppm (ESPN gamelog last 5g; fallback: depth proxy)");
  console.log("[gen] DK tiers: top12%=$4, 12-40%=$3, 40-70%=$2, rest=$1");
  console.log("[gen] Star floor: pool top3=$4, each team top2 minCost=$3");
  console.log("[gen] Per-team cap: max 2 at $4");
  console.log("[gen] Runtime: DATA_MODE=SNAPSHOT → 0 external fetch");

  // Determine today + tomorrow in UTC (consistent with lockAt timestamps)
  var nowUTC  = new Date();
  var todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));
  var tmrwUTC  = new Date(todayUTC.getTime() + 86400000);
  console.log("[gen] Today (UTC):", dateStr(todayUTC), "| Tomorrow:", dateStr(tmrwUTC));

  var result = null;

  // ── Source 1: Sportradar ──────────────────────────────────────────────────
  if (SR_KEY) {
    console.log("\n[gen] Trying Sportradar...");
    try {
      result = await generateFromSportradar(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] Sportradar: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] Sportradar: 0 pools");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] Sportradar FAILED:", e.message, "→ falling back to ESPN");
      result = null;
    }
  }

  // ── Source 2: ESPN ────────────────────────────────────────────────────────
  if (!result) {
    console.log("\n[gen] Trying ESPN (free, no key)...");
    try {
      result = await generateFromESPN(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] ESPN: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] ESPN: 0 pools");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] ESPN FAILED:", e.message, "→ falling back to BDL+ESPN");
      result = null;
    }
  }

  // ── Source 3: BDL + ESPN ──────────────────────────────────────────────────
  if (!result) {
    console.log("\n[gen] Trying BDL+ESPN...");
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
    // Strip internal fields before writing
    var cleanPlayers = players.map(function(p) {
      var out = Object.assign({}, p);
      delete out._rosterIdx;
      delete out._espnId;
      return out;
    });
    var pFile = path.join(SNAP_DIR, "players." + pool.id + ".json");
    safeWrite(pFile, cleanPlayers);
    writtenCount++;
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n[gen] ============================================================");
  console.log("[gen] DONE. Source:", result.source);
  console.log("[gen] Pools:", result.pools.length, "| Player files written:", writtenCount);
  console.log("[gen] Pool IDs:");
  result.pools.forEach(function(p) {
    var players = result.playerMap[p.id] || [];
    var playableCount = players.filter(function(pl){return pl.isPlayable;}).length;
    var outCount = players.filter(function(pl){return !pl.isPlayable;}).length;
    console.log("[gen]   ", p.id, "|", p.title, "| players:", players.length,
      "(playable:", playableCount + ", out/inactive:", outCount + ")");
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
      var costDist = {};
      pp.forEach(function(p) { costDist[p.cost] = (costDist[p.cost] || 0) + 1; });
      console.log("[gen] Cost distribution:", JSON.stringify(costDist));
      var hasProj  = pp.every(function(p) { return p.proj != null; });
      var hasValue = pp.every(function(p) { return p.value != null; });
      console.log("[gen] All players have proj:", hasProj, "| value:", hasValue);
      console.log("[gen] First 5 players:");
      pp.slice(0, 5).forEach(function(p) {
        console.log("[gen]   ", p.name, "(" + p.team + ", $" + p.cost + ", proj=" + p.proj +
          ", value=" + p.value + ", " + p.position + ", " + p.projSource + ", status:" + p.injuryStatus + ")");
      });
    }
  }

  // ── Roster correctness checks ─────────────────────────────────────────────
  console.log("\n[gen] === Roster Correctness Check ===");
  var foundCurry = false, foundAD = false, foundLeBron = false;
  result.pools.forEach(function(pool) {
    var players = result.playerMap[pool.id] || [];
    players.forEach(function(p) {
      if (p.name === "Stephen Curry") {
        console.log("[gen] Stephen Curry: team=" + p.team + " cost=$" + p.cost +
          " proj=" + p.proj + " value=" + p.value + " status=" + p.injuryStatus + " pool=" + pool.id);
        foundCurry = true;
      }
      if (p.name === "Anthony Davis") {
        console.log("[gen] Anthony Davis: team=" + p.team + " status=" + p.injuryStatus + " pool=" + pool.id);
        if (p.team === "LAL") console.warn("[gen] WARNING: Anthony Davis still showing LAL");
        foundAD = true;
      }
      if (p.name === "LeBron James") {
        console.log("[gen] LeBron James: team=" + p.team + " cost=$" + p.cost +
          " proj=" + p.proj + " value=" + p.value + " status=" + p.injuryStatus + " pool=" + pool.id);
        foundLeBron = true;
      }
    });
  });
  if (!foundCurry)  console.log("[gen] (Stephen Curry not in any pool today/tomorrow)");
  if (!foundAD)     console.log("[gen] (Anthony Davis not in any pool today/tomorrow)");
  if (!foundLeBron) console.log("[gen] (LeBron James not in any pool today/tomorrow)");
  console.log("[gen] ============================================================");
}

main().catch(function(e) {
  console.error("[gen] Fatal:", e.message || e);
  process.exit(1);
});
