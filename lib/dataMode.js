"use strict";
/**
 * lib/dataMode.js — Central data-mode gate.
 * DATA_MODE: SNAPSHOT (default) | LIVE | DEMO (alias for SNAPSHOT)
 */
var _mode = (process.env.DATA_MODE || "SNAPSHOT").toUpperCase();
if (_mode === "DEMO") _mode = "SNAPSHOT";
var DATA_MODE = _mode;
function isSnapshot() { return DATA_MODE !== "LIVE"; }
function isLive()     { return DATA_MODE === "LIVE"; }
module.exports = { DATA_MODE, isSnapshot, isLive };
