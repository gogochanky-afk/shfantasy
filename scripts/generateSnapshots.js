#!/usr/bin/env node
"use strict";
/**
 * scripts/generateSnapshots.js  v2.3
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2C additions over v2.2 (Salary 2A):
 *   - valueScore per player: depth/role proxy + position weight
 *     (ESPN roster order ≈ depth chart; first 5 per team = starters)
 *   - Tier assignment (pool-wide, deterministic):
 *       top 15%  → cost 4
 *       next 25% → cost 3
 *       next 35% → cost 2
 *       rest     → cost 1
 *   - Per-team cap enforcement:
 *       max 2 cost=4 per team; max 4 cost>=3 per team
 *       excess pushed down by 1
 *   - Each player JSON carries: valueScore (for transparency)
 *   - Pool snapshot carries: playerCount, outCount (for UI badges)
 *
 * Source priority (unchanged from v2.2):
 *   1. Sportradar (if SPORTRADAR_API_KEY set)
 *   2. ESPN public API (no key required)
 *   3. BallDontLie schedule + ESPN rosters
 *   4. Preserve existing snapshots
 *
 * Throttling: serial + 1200ms gap; 429 → backoff (2s→4s→8s→16s→20s), max 5 retries
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

// Salary 2A tier thresholds (applied pool-wide across both teams)
var TIER4_PCT = 0.15;  // top 15%  → cost 4
var TIER3_PCT = 0.40;  // top 40%  → cost 3 (15%+25%)
var TIER2_PCT = 0.75;  // top 75%  → cost 2 (15%+25%+35%)
// rest → cost 1

// Per-team salary cap constraints
var MAX_COST4_PER_TEAM = 2;  // max 2 players with cost=4 per team
var MAX_COST3UP_PER_TEAM = 4; // max 4 players with cost>=3 per team

// CLI flag: --include-inactive writes all players (for debugging)
var INCLUDE_INACTIVE = process.argv.indexOf("--include-inactive") !== -1;

// ESPN non-standard abbreviation normalisation
var ESPN_ABBR_FIX = {
  "GS":   "GSW",
  "NY":   "NYK",
  "SA":   "SAS",
  "NO":   "NOP",
  "UTAH": "UTA",
  "WSH":  "WAS",
};

// ESPN team id → slug (kept for reference)
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
      "User-Agent": "SHFantasy-SnapshotGen/2.3 (compatible)",
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
/**
 * Normalise ESPN injury status string to our standard enum:
 *   "active" | "questionable" | "out" | "inactive" | "unknown"
 */
function normaliseInjuryStatus(espnInjuryStatus) {
  if (!espnInjuryStatus) return "active";
  var s = String(espnInjuryStatus).toLowerCase().trim();
  if (s === "out")                           return "out";
  if (s === "inactive" || s === "suspended") return "inactive";
  if (s === "day-to-day" || s === "questionable") return "questionable";
  if (s === "probable")                      return "questionable";
  return "unknown";
}
function isPlayable(injuryStatus) {
  return injuryStatus !== "out" && injuryStatus !== "inactive";
}

// ── Salary 2A: valueScore + tier assignment ───────────────────────────────────
/**
 * Position weight: C > PF/SF > PG/SG > G/F
 * This is the base for valueScore when stats are unavailable.
 */
function posWeight(pos) {
  if (!pos) return 1;
  var p = pos.toUpperCase();
  if (p === "C")                return 4;
  if (p === "PF" || p === "SF") return 3;
  if (p === "PG" || p === "SG") return 2;
  if (p.indexOf("C") !== -1)    return 3;
  if (p.indexOf("F") !== -1)    return 2;
  return 1;
}

/**
 * Compute valueScore for a player.
 * When stats are available (avgMin, avgPts, avgReb, avgAst), use them.
 * Otherwise fall back to depth/role proxy:
 *   - rosterIndex: position in ESPN roster array (0 = first listed = likely starter)
 *   - rosterSize:  total players on team roster
 *   - posWeight:   position weight
 *
 * Formula (no stats):
 *   depthScore = (1 - rosterIndex / rosterSize) * 10   → 0..10
 *   rolebonus  = rosterIndex < 5 ? 3 : 0               → starter bonus
 *   valueScore = depthScore + roleBonus + posWeight
 *
 * Formula (with stats):
 *   valueScore = avgMin * 0.3 + avgPts * 0.4 + avgReb * 0.15 + avgAst * 0.15
 *                + posWeight
 */
function computeValueScore(player, rosterIndex, rosterSize) {
  var pw = posWeight(player.position);
  // If stats are attached (future extension)
  if (player.avgMin != null && player.avgPts != null) {
    return (player.avgMin  || 0) * 0.3
         + (player.avgPts  || 0) * 0.4
         + (player.avgReb  || 0) * 0.15
         + (player.avgAst  || 0) * 0.15
         + pw;
  }
  // Depth proxy
  var n = rosterSize > 0 ? rosterSize : 15;
  var depthScore = (1 - rosterIndex / n) * 10;
  var roleBonus  = rosterIndex < 5 ? 3 : 0;
  return depthScore + roleBonus + pw;
}

/**
 * Assign valueScore to each player in a team's roster.
 * rosterOrder: the order the players appear in the source (ESPN depth order).
 */
function enrichWithValueScore(players) {
  var n = players.length;
  return players.map(function(p, i) {
    var vs = computeValueScore(p, i, n);
    return Object.assign({}, p, { valueScore: Math.round(vs * 100) / 100 });
  });
}

/**
 * Assign cost tiers pool-wide (across both teams combined).
 * S3 tier rules:
 *   top 15%  → cost 4
 *   next 25% → cost 3  (cumulative 40%)
 *   next 35% → cost 2  (cumulative 75%)
 *   rest     → cost 1
 *
 * Then enforce per-team cap:
 *   max 2 cost=4 per team; max 4 cost>=3 per team (excess → cost-1)
 */
function assignCostsByValueScore(players) {
  if (!players || players.length === 0) return players;
  var n = players.length;

  // Sort by valueScore DESC for tier assignment
  var sorted = players.slice().sort(function(a, b) {
    var va = a.valueScore || 0, vb = b.valueScore || 0;
    if (vb !== va) return vb - va;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Assign raw tiers
  var t4 = Math.max(1, Math.round(n * TIER4_PCT));
  var t3 = Math.max(1, Math.round(n * TIER3_PCT));
  var t2 = Math.max(1, Math.round(n * TIER2_PCT));

  var withRawCost = sorted.map(function(p, i) {
    var cost;
    if (i < t4)      cost = 4;
    else if (i < t3) cost = 3;
    else if (i < t2) cost = 2;
    else             cost = 1;
    return Object.assign({}, p, { cost: cost });
  });

  // Enforce per-team cap: group by team
  var byTeam = {};
  withRawCost.forEach(function(p) {
    if (!byTeam[p.team]) byTeam[p.team] = [];
    byTeam[p.team].push(p);
  });

  // For each team, sort by cost DESC, then apply cap
  Object.keys(byTeam).forEach(function(team) {
    var teamPlayers = byTeam[team].sort(function(a, b) { return b.cost - a.cost; });
    var count4 = 0, count3up = 0;
    teamPlayers.forEach(function(p) {
      if (p.cost === 4) {
        count4++;
        if (count4 > MAX_COST4_PER_TEAM) {
          p.cost = 3;
          count4--; // revert increment since we changed it
          count4 = MAX_COST4_PER_TEAM; // cap at max
        }
      }
      if (p.cost >= 3) {
        count3up++;
        if (count3up > MAX_COST3UP_PER_TEAM) {
          p.cost = Math.max(1, p.cost - 1);
          count3up--;
          count3up = MAX_COST3UP_PER_TEAM;
        }
      }
    });
  });

  // Restore original player order (preserve team grouping from buildTeamPlayers)
  var costMap = {};
  withRawCost.forEach(function(p) { costMap[p.id] = p.cost; });
  return players.map(function(p) {
    return Object.assign({}, p, { cost: costMap[p.id] || 1 });
  });
}

/**
 * Apply rotation limit + playable filter to one team's players.
 * Enriches with valueScore BEFORE filtering (so depth order is preserved).
 */
function buildTeamPlayers(rawPlayers, max, min) {
  // Step 1: enrich with valueScore (uses roster order as depth proxy)
  var withVS = enrichWithValueScore(rawPlayers);

  if (INCLUDE_INACTIVE) {
    return withVS.slice(0, max);
  }
  // Step 2: playable filter
  var playable = withVS.filter(function(p) { return p.isPlayable; });
  // Step 3: rotation limit
  var result = playable.length <= max ? playable : playable.slice(0, max);
  // Step 4: relax if too few (add OUT as last resort)
  if (result.length < min) {
    var outPlayers = withVS.filter(function(p) { return p.injuryStatus === "out"; });
    var needed = min - result.length;
    if (outPlayers.length > 0 && needed > 0) {
      console.warn("[gen] Relaxing filter — adding", Math.min(needed, outPlayers.length), "OUT players");
      result = result.concat(outPlayers.slice(0, needed));
    }
  }
  return result;
}

/**
 * Combine home + away players, assign pool-wide cost tiers, return final list.
 * Also computes playerCount and outCount for pool metadata.
 */
function buildPoolPlayers(homePlayers, awayPlayers, homeFull, awayFull) {
  var homeFiltered = buildTeamPlayers(homePlayers, MAX_PER_TEAM, MIN_PER_TEAM);
  var awayFiltered = buildTeamPlayers(awayPlayers, MAX_PER_TEAM, MIN_PER_TEAM);
  var combined = homeFiltered.concat(awayFiltered);

  if (combined.length < MIN_TOTAL) {
    // Last resort: use full roster
    console.warn("[gen] Not enough playable players (got:", combined.length + ") — using full roster");
    var homeAll = enrichWithValueScore(homePlayers).slice(0, MAX_PER_TEAM);
    var awayAll = enrichWithValueScore(awayPlayers).slice(0, MAX_PER_TEAM);
    combined = homeAll.concat(awayAll);
  }

  // Assign costs pool-wide using Salary 2A
  var withCosts = assignCostsByValueScore(combined);
  return withCosts;
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
        name:         a.displayName || a.fullName || "Unknown",
        team:         teamAbbr,
        teamFull:     teamFull,
        position:     (a.position && a.position.abbreviation) || "G",
        jersey:       a.jersey || "",
        cost:         1, // overwritten by assignCostsByValueScore
        valueScore:   0, // overwritten by enrichWithValueScore
        injuryStatus: injStatus,
        injuryNote:   injNote || null,
        isPlayable:   playable,
        // roster index preserved for depth proxy (idx = ESPN roster order)
        _rosterIdx:   idx,
      };
    });
  } catch (e) {
    console.warn("[ESPN] Roster parse error:", e.message);
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

      console.log("[ESPN] Fetching home roster:", g.homeTeam.abbr, "(id:", g.homeTeam.id + ")");
      var homePlayers = await espnRoster(g.homeTeam.id, g.homeTeam.abbr, g.homeTeam.name);
      console.log("[ESPN]  ->", homePlayers.length, "raw players (" +
        homePlayers.filter(function(p){return p.isPlayable;}).length + " playable, " +
        homePlayers.filter(function(p){return !p.isPlayable;}).length + " out/inactive)");

      console.log("[ESPN] Fetching away roster:", g.awayTeam.abbr, "(id:", g.awayTeam.id + ")");
      var awayPlayers = await espnRoster(g.awayTeam.id, g.awayTeam.abbr, g.awayTeam.name);
      console.log("[ESPN]  ->", awayPlayers.length, "raw players (" +
        awayPlayers.filter(function(p){return p.isPlayable;}).length + " playable, " +
        awayPlayers.filter(function(p){return !p.isPlayable;}).length + " out/inactive)");

      var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, g.homeTeam.name, g.awayTeam.name);
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
    name:         name,
    team:         teamAbbr,
    teamFull:     teamFull,
    position:     p.primary_position || p.position || "G",
    jersey:       p.jersey_number || "",
    cost:         1,
    valueScore:   0,
    injuryStatus: injStatus,
    injuryNote:   null,
    isPlayable:   playable,
    _rosterIdx:   idx || 0,
  };
}
async function generateFromSportradar(today, tomorrow) {
  var schedule = await srGet("/games/" + dateStr(today) + "/schedule.json");
  var tmrwSched = await srGet("/games/" + dateStr(tomorrow) + "/schedule.json");
  var allGames = [];
  ((schedule.games || [])).forEach(function(g) { allGames.push({ g: g, tag: "today", date: today }); });
  ((tmrwSched.games || [])).forEach(function(g) { allGames.push({ g: g, tag: "tmrw", date: tomorrow }); });
  var allPools  = [];
  var playerMap = {};
  for (var i = 0; i < allGames.length; i++) {
    var item = allGames[i];
    var g    = item.g;
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
    var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, homeName, awayName);
    var outCount = (homePlayers.filter(function(p){return !p.isPlayable;}).length +
                    awayPlayers.filter(function(p){return !p.isPlayable;}).length);
    allPools[allPools.length - 1].playerCount = poolPlayers.length;
    allPools[allPools.length - 1].outCount    = outCount;
    if (poolPlayers.length >= MIN_TOTAL) playerMap[pid] = poolPlayers;
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
        console.log("[BDL+ESPN] Fetching home roster:", homeAbbr, "(ESPN id:", homeEspnId + ")");
        homePlayers = await espnRoster(homeEspnId, homeAbbr, homeName);
      }
      if (awayEspnId) {
        console.log("[BDL+ESPN] Fetching away roster:", awayAbbr, "(ESPN id:", awayEspnId + ")");
        awayPlayers = await espnRoster(awayEspnId, awayAbbr, awayName);
      }
      var poolPlayers = buildPoolPlayers(homePlayers, awayPlayers, homeName, awayName);
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
  console.log("[gen] SH Fantasy Snapshot Generator v2.3");
  console.log("[gen] Include inactive:", INCLUDE_INACTIVE ? "YES (debug)" : "NO (default)");
  console.log("[gen] Salary mode: 2A (valueScore + pool-wide tiers + per-team cap)");

  var todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  var tmrwUTC  = new Date(todayUTC.getTime() + 86400000);

  console.log("[gen] Today (UTC):", dateStr(todayUTC));
  console.log("[gen] Tomorrow (UTC):", dateStr(tmrwUTC));

  var result = null;

  // ── Source 1: Sportradar ──────────────────────────────────────────────────
  if (SR_KEY) {
    console.log("\n[gen] Trying Source 1: Sportradar (key present)...");
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
  } else {
    console.log("[gen] Source 1: Sportradar skipped (no SPORTRADAR_API_KEY)");
  }

  // ── Source 2: ESPN ────────────────────────────────────────────────────────
  if (!result) {
    console.log("\n[gen] Trying Source 2: ESPN (no key required)...");
    try {
      result = await generateFromESPN(todayUTC, tmrwUTC);
      if (result && result.pools.length > 0) {
        console.log("[gen] ESPN: SUCCESS -", result.pools.length, "pools");
      } else {
        console.warn("[gen] ESPN: 0 pools");
        result = null;
      }
    } catch (e) {
      console.warn("[gen] ESPN FAILED:", e.message);
      result = null;
    }
  }

  // ── Source 3: BallDontLie + ESPN rosters ─────────────────────────────────
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
      // Cost distribution
      var costDist = {};
      pp.forEach(function(p) { costDist[p.cost] = (costDist[p.cost] || 0) + 1; });
      console.log("[gen] Cost distribution:", JSON.stringify(costDist));
      console.log("[gen] First 5 players:");
      pp.slice(0, 5).forEach(function(p) {
        console.log("[gen]   ", p.name, "(" + p.team + ", $" + p.cost + ", " + p.position + ", vs=" + p.valueScore + ", status:" + p.injuryStatus + ")");
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
        console.log("[gen] Stephen Curry: team=" + p.team + " cost=$" + p.cost + " vs=" + p.valueScore + " status=" + p.injuryStatus + " pool=" + pool.id);
        foundCurry = true;
      }
      if (p.name === "Anthony Davis") {
        console.log("[gen] Anthony Davis: team=" + p.team + " status=" + p.injuryStatus + " pool=" + pool.id);
        if (p.team === "LAL") console.warn("[gen] WARNING: Anthony Davis still showing LAL");
        foundAD = true;
      }
      if (p.name === "LeBron James") {
        console.log("[gen] LeBron James: team=" + p.team + " cost=$" + p.cost + " vs=" + p.valueScore + " status=" + p.injuryStatus + " pool=" + pool.id);
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
