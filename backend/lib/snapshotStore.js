"use strict";

/**
 * snapshotStore.js — local JSON store for SNAPSHOT mode
 * Zero DB. Pure JSON. Used for testing without Sportradar or SQLite.
 */
const fs = require("fs");
const path = require("path");

function readJSON(fileName) {
  const filePath = path.join(__dirname, "../data", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = {
  getPools() {
    return readJSON("pools.json");
  },

  getPlayers() {
    return readJSON("players.json");
  },

  joinPool(userId, poolId) {
    return { userId, poolId, entryId: `entry_${Date.now()}` };
  },

  getUserEntries(userId) {
    return [{ entryId: "demo123", poolId: 1, userId }];
  },

  setLineup(entryId, players) {
    return { entryId, players, savedAt: new Date().toISOString() };
  },

  getAllLineups() {
    return readJSON("lineups.json");
  },

  reset() {
    return true;
  },
};
