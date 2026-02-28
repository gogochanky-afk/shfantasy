"use strict";
/**
 * lib/snapshotStore.js
 * Zero network calls. Zero DB. Zero better-sqlite3.
 * Fallback chain for pools:
 *   1. data/snapshots/pools.snapshot.json
 *   2. data/snapshot_pools.json
 *   3. hardcoded constants
 * Fallback chain for players(poolId):
 *   1. data/snapshots/players.<poolId>.json
 *   2. data/snapshots/players.fallback.json
 *   3. data/snapshot_players.json[poolId]
 *   4. hardcoded 14 players
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
function fileMtime(fp) {
  try { return fs.statSync(fp).mtime.toISOString(); } catch(_) { return new Date().toISOString(); }
}
function defaultLockAt(i) {
  return new Date(Date.now() + (i === 0 ? 4 : 28) * 3600000).toISOString();
}
function hardcodedPools() {
  return [
    { id:"pool-lal-gsw-today", label:"Lakers vs Warriors", title:"Los Angeles Lakers vs Golden State Warriors",
      homeTeam:{abbr:"LAL",name:"Los Angeles Lakers"}, awayTeam:{abbr:"GSW",name:"Golden State Warriors"},
      lockAt:defaultLockAt(0), rosterSize:5, salaryCap:10, status:"open", day:"today" },
    { id:"pool-bos-mia-tmrw", label:"Celtics vs Heat", title:"Boston Celtics vs Miami Heat",
      homeTeam:{abbr:"BOS",name:"Boston Celtics"}, awayTeam:{abbr:"MIA",name:"Miami Heat"},
      lockAt:defaultLockAt(1), rosterSize:5, salaryCap:10, status:"open", day:"tomorrow" },
  ];
}
function hardcodedPlayers() {
  return [
    {id:"fb-1",  name:"LeBron James",     team:"LAL",teamFull:"Los Angeles Lakers",       position:"SF",cost:4,injuryStatus:null},
    {id:"fb-2",  name:"Anthony Davis",    team:"LAL",teamFull:"Los Angeles Lakers",       position:"C", cost:3,injuryStatus:null},
    {id:"fb-3",  name:"Austin Reaves",    team:"LAL",teamFull:"Los Angeles Lakers",       position:"SG",cost:2,injuryStatus:null},
    {id:"fb-4",  name:"D'Angelo Russell", team:"LAL",teamFull:"Los Angeles Lakers",      position:"PG",cost:2,injuryStatus:null},
    {id:"fb-5",  name:"Rui Hachimura",    team:"LAL",teamFull:"Los Angeles Lakers",       position:"PF",cost:1,injuryStatus:null},
    {id:"fb-6",  name:"Jarred Vanderbilt",team:"LAL",teamFull:"Los Angeles Lakers",       position:"PF",cost:1,injuryStatus:null},
    {id:"fb-7",  name:"Stephen Curry",    team:"GSW",teamFull:"Golden State Warriors",    position:"PG",cost:4,injuryStatus:null},
    {id:"fb-8",  name:"Klay Thompson",    team:"GSW",teamFull:"Golden State Warriors",    position:"SG",cost:2,injuryStatus:null},
    {id:"fb-9",  name:"Draymond Green",   team:"GSW",teamFull:"Golden State Warriors",    position:"PF",cost:2,injuryStatus:null},
    {id:"fb-10", name:"Andrew Wiggins",   team:"GSW",teamFull:"Golden State Warriors",    position:"SF",cost:2,injuryStatus:null},
    {id:"fb-11", name:"Kevon Looney",     team:"GSW",teamFull:"Golden State Warriors",    position:"C", cost:1,injuryStatus:null},
    {id:"fb-12", name:"Jonathan Kuminga", team:"GSW",teamFull:"Golden State Warriors",    position:"SF",cost:2,injuryStatus:null},
    {id:"fb-13", name:"Jayson Tatum",     team:"BOS",teamFull:"Boston Celtics",           position:"SF",cost:4,injuryStatus:null},
    {id:"fb-14", name:"Jaylen Brown",     team:"BOS",teamFull:"Boston Celtics",           position:"SG",cost:3,injuryStatus:null},
  ];
}
function loadPools() {
  if (_poolsCache) return _poolsCache;
  var snapFile = path.join(SNAP_DIR, "pools.snapshot.json");
  var p = tryReadJSON(snapFile) || tryReadJSON(path.join(DATA_DIR, "snapshot_pools.json"));
  if (p && Array.isArray(p.pools) && p.pools.length > 0) {
    p.pools.forEach(function(pool, i) {
      if (!pool.lockAt) pool.lockAt = defaultLockAt(i);
      if (typeof pool.homeTeam === "string") pool.homeTeam = { abbr: pool.homeTeam, name: pool.homeTeam };
      if (typeof pool.awayTeam === "string") pool.awayTeam = { abbr: pool.awayTeam, name: pool.awayTeam };
    });
    return (_poolsCache = {
      dataMode:  p.dataMode || "SNAPSHOT",
      updatedAt: p.generatedAt || fileMtime(snapFile),
      pools:     p.pools,
    });
  }
  console.warn("[snapshotStore] Using hardcoded pool fallback");
  return (_poolsCache = { dataMode:"SNAPSHOT", updatedAt:new Date().toISOString(), pools:hardcodedPools() });
}
function loadPlayers(poolId) {
  if (_playersCache[poolId]) return _playersCache[poolId];
  // 1. Exact pool file
  var exact = tryReadJSON(path.join(SNAP_DIR, "players." + poolId + ".json"));
  if (Array.isArray(exact) && exact.length > 0) return (_playersCache[poolId] = exact);
  // 2. Fallback file
  var fallback = tryReadJSON(path.join(SNAP_DIR, "players.fallback.json"));
  if (Array.isArray(fallback) && fallback.length > 0) {
    console.warn("[snapshotStore] Using players.fallback.json for pool:", poolId);
    return (_playersCache[poolId] = fallback);
  }
  // 3. Combined legacy file
  var combined = tryReadJSON(path.join(DATA_DIR, "snapshot_players.json"));
  if (combined) {
    var fromCombined = combined[poolId] || combined["pool-lal-gsw-today"] || [];
    if (fromCombined.length > 0) return (_playersCache[poolId] = fromCombined);
    var all = [];
    Object.keys(combined).forEach(function(k){ all = all.concat(combined[k]); });
    if (all.length > 0) return (_playersCache[poolId] = all);
  }
  // 4. Hardcoded
  console.warn("[snapshotStore] Using hardcoded player fallback for pool:", poolId);
  return (_playersCache[poolId] = hardcodedPlayers());
}
function getPools() { return loadPools(); }
function getPlayers(poolId) {
  var players = loadPlayers(poolId || "fallback");
  var snapFile = path.join(SNAP_DIR, "players." + (poolId || "fallback") + ".json");
  return {
    dataMode:  "SNAPSHOT",
    poolId:    poolId || "fallback",
    updatedAt: fs.existsSync(snapFile) ? fileMtime(snapFile) : new Date().toISOString(),
    players:   players,
  };
}
function clearCache() { _poolsCache = null; _playersCache = {}; console.log("[snapshotStore] Cache cleared"); }
module.exports = { getPools, getPlayers, clearCache };
