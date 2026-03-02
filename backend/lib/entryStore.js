"use strict";

let ENTRY_STORE = {
  version: "SNAPSHOT_MEMORY_ONLY",
  entries: [],
};

function addEntry(e) {
  ENTRY_STORE.entries.push(e);
}

module.exports = {
  ENTRY_STORE,
  addEntry,
};
