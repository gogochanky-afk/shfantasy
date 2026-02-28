"use strict";
/**
 * lib/db.js — STUB for Snapshot Playtest Mode
 * All DB operations are no-ops. No better-sqlite3. No file I/O.
 * This stub exists so any legacy require('./db') does NOT crash the process.
 */

var _noop = function () { return null; };
var _noopArr = function () { return []; };

var db = {
  prepare: function () {
    return { run: _noop, get: _noop, all: _noopArr };
  },
  exec: _noop,
  transaction: function (fn) { return fn; }
};

module.exports = {
  db: db,
  getLatestRoster:    _noopArr,
  saveRosterSnapshot: _noop,
  getOrCreateTeam:    _noop,
  upsertPool:         _noop,
  getTodayTomorrowPools: _noopArr,
  saveEntry:          _noop,
  getAllEntries:       _noopArr,
  getOpenPools:       _noopArr,
  getPoolById:        _noop,
  createEntry:        _noop,
  getEntryById:       _noop,
  saveLineup:         _noop,
  getLineupByEntryId: _noop,
  getLeaderboard:     _noopArr
};
