"use strict";

/**
 * DATA_MODE handling — determines whether backend is running in SNAPSHOT or LIVE.
 */
const DATA_MODE = process.env.DATA_MODE || "SNAPSHOT";

function isSnapshot() {
  return DATA_MODE === "SNAPSHOT";
}

module.exports = {
  DATA_MODE,
  isSnapshot,
};
