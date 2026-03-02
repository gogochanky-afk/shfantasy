"use strict";

module.exports = {
  fetchLiveStats() {
    return {
      ok: false,
      message: "Sportradar LIVE mode not enabled in SNAPSHOT environment",
    };
  },
};
