"use strict";
/**
 * lib/snapshotStore.js
 * Reads snapshot data from /data/snapshots/*.json (in-memory cache).
 * Zero network calls. Zero DB. Zero better-sqlite3.
 * Falls back: /data/snapshots/ -> /data/ -> hardcoded constants.
 */
const path = require("path");
const fs   = require("fs");
const SNAP_DIR = path.join(__dirname, "..", "data", "snapshots");
const DATA_DIR = path.join(__dirname, "..", "data");
var _poolsCache   = null;
var _playersCache = {};
function tryReadJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, "utf8")); } catch(_) { return null; }
}
function lockAt(i) {
  return new Date(Date.now() + (i === 0 ? 4 : 28) * 3600000).toISOString();
}
function loadPools() {
  if (_poolsCache) return _poolsCache;
  var p = tryReadJSON(path.join(SNAP_DIR, "pools.snapshot.json"))
       || tryReadJSON(path.join(DATA_DIR, "snapshot_pools.json"));
  if (p && Array.isArray(p.pools)) {
    p.pools.forEach(function(pool, i){ if (!pool.lockAt) pool.lockAt = lockAt(i); });
    return (_poolsCache = p);
  }
  console.warn("[snapshotStore] Using hardcoded pool fallback");
  return (_poolsCache = {
    dataMode: "SNAPSHOT",
    pools: [
      { id:"pool-lal-gsw-today", label:"Lakers vs Warriors", title:"Lakers vs Warriors",
        homeTeam:"LAL", homeTeamFull:"Los Angeles Lakers",
        awayTeam:"GSW", awayTeamFull:"Golden State Warriors",
        status:"open", rosterSize:5, salaryCap:10, day:"today", lockAt:lockAt(0) },
      { id:"pool-bos-mia-tmrw", label:"Celtics vs Heat", title:"Celtics vs Heat",
        homeTeam:"BOS", homeTeamFull:"Boston Celtics",
        awayTeam:"MIA", awayTeamFull:"Miami Heat",
        status:"open", rosterSize:5, salaryCap:10, day:"tomorrow", lockAt:lockAt(1) }
    ]
  });
}
function loadPlayers(poolId) {
  if (_playersCache[poolId]) return _playersCache[poolId];
  var players = tryReadJSON(path.join(SNAP_DIR, "players." + poolId + ".json"));
  if (!players) {
    var combined = tryReadJSON(path.join(DATA_DIR, "snapshot_players.json"));
    if (combined && combined[poolId]) players = combined[poolId];
  }
  if (Array.isArray(players) && players.length > 0) {
    return (_playersCache[poolId] = players);
  }
  // Aggregate all pools as fallback
  var all = [];
  var c2 = tryReadJSON(path.join(DATA_DIR, "snapshot_players.json"));
  if (c2) Object.keys(c2).forEach(function(k){ all = all.concat(c2[k]); });
  if (all.length > 0) return (_playersCache[poolId] = all);
  console.warn("[snapshotStore] Using hardcoded player fallback for:", poolId);
  return (_playersCache[poolId] = [
    {id:"fb-1", name:"LeBron James",   team:"LAL",teamFull:"Los Angeles Lakers",   position:"SF",cost:4,injuryStatus:null},
    {id:"fb-2", name:"Stephen Curry",  team:"GSW",teamFull:"Golden State Warriors",position:"PG",cost:4,injuryStatus:null},
    {id:"fb-3", name:"Jayson Tatum",   team:"BOS",teamFull:"Boston Celtics",       position:"SF",cost:4,injuryStatus:null},
    {id:"fb-4", name:"Jimmy Butler",   team:"MIA",teamFull:"Miami Heat",           position:"SF",cost:4,injuryStatus:null},
    {id:"fb-5", name:"Anthony Davis",  team:"LAL",teamFull:"Los Angeles Lakers",   position:"C", cost:3,injuryStatus:null},
    {id:"fb-6", name:"Draymond Green", team:"GSW",teamFull:"Golden State Warriors",position:"PF",cost:2,injuryStatus:null},
    {id:"fb-7", name:"Jaylen Brown",   team:"BOS",teamFull:"Boston Celtics",       position:"SG",cost:3,injuryStatus:null},
    {id:"fb-8", name:"Bam Adebayo",    team:"MIA",teamFull:"Miami Heat",           position:"C", cost:3,injuryStatus:null},
    {id:"fb-9", name:"Austin Reaves",  team:"LAL",teamFull:"Los Angeles Lakers",   position:"SG",cost:2,injuryStatus:null},
    {id:"fb-10",name:"Klay Thompson",  team:"GSW",teamFull:"Golden State Warriors",position:"SG",cost:2,injuryStatus:null},
    {id:"fb-11",name:"Jrue Holiday",   team:"BOS",teamFull:"Boston Celtics",       position:"PG",cost:2,injuryStatus:null},
    {id:"fb-12",name:"Tyler Herro",    team:"MIA",teamFull:"Miami Heat",           position:"SG",cost:2,injuryStatus:null},
    {id:"fb-13",name:"Rui Hachimura",  team:"LAL",teamFull:"Los Angeles Lakers",   position:"PF",cost:1,injuryStatus:null},
    {id:"fb-14",name:"Kevon Looney",   team:"GSW",teamFull:"Golden State Warriors",position:"C", cost:1,injuryStatus:null},
  ]);
}
function getPools()     { return loadPools(); }
function getPlayers(id) {
  return { dataMode:"SNAPSHOT", poolId:id||"fallback", updatedAt:new Date().toISOString(), players:loadPlayers(id) };
}
module.exports = { getPools, getPlayers };
