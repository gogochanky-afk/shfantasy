"use strict";

/**
 * config.js — environment configuration
 */

module.exports = {
  port: process.env.PORT || 8080,
  dataMode: process.env.DATA_MODE || "SNAPSHOT",
};
