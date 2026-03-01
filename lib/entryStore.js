"use strict";
/**
 * lib/entryStore.js
 * Persistent entry store: Google Cloud Storage (primary) + in-memory (fallback).
 *
 * GCS layout:
 *   entries/{username}/{entryId}.json  → entry object
 *
 * Entry schema:
 *   { entryId, username, poolId, createdAt, lineup:[], salaryUsed:0, updatedAt }
 *
 * If BUCKET_NAME env var is missing, falls back to in-memory store with a
 * console warning. The runtime flag ENTRY_STORE is set to "GCS" or "MEMORY"
 * and is exposed for the healthz endpoint.
 */

const BUCKET_NAME = process.env.BUCKET_NAME || "";
const PREFIX      = "entries/";

// ── In-memory store (fallback) ────────────────────────────────────────────────
// Map: entryId → entry object
const _mem = new Map();

// ── GCS client (lazy init) ────────────────────────────────────────────────────
let _gcs    = null;
let _bucket = null;

function getGCS() {
  if (_gcs) return _gcs;
  try {
    const { Storage } = require("@google-cloud/storage");
    _gcs    = new Storage();
    _bucket = _gcs.bucket(BUCKET_NAME);
    return _gcs;
  } catch (e) {
    console.error("[entryStore] Failed to init GCS:", e.message);
    return null;
  }
}

// ── Exported mode flag ────────────────────────────────────────────────────────
const ENTRY_STORE = BUCKET_NAME ? "GCS" : "MEMORY";
if (!BUCKET_NAME) {
  console.warn("[entryStore] BUCKET_NAME not set — using in-memory store (ENTRY_STORE=MEMORY). Entries will be lost on restart.");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gcsKey(username, entryId) {
  // sanitise to prevent path traversal
  var u = String(username).replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();
  var e = String(entryId).replace(/[^a-zA-Z0-9_\-]/g, "_");
  return PREFIX + u + "/" + e + ".json";
}

async function gcsWrite(key, obj) {
  getGCS();
  if (!_bucket) throw new Error("GCS bucket not available");
  var file = _bucket.file(key);
  await file.save(JSON.stringify(obj), { contentType: "application/json", resumable: false });
}

async function gcsRead(key) {
  getGCS();
  if (!_bucket) return null;
  try {
    var file = _bucket.file(key);
    var [exists] = await file.exists();
    if (!exists) return null;
    var [contents] = await file.download();
    return JSON.parse(contents.toString("utf8"));
  } catch (e) {
    console.warn("[entryStore] GCS read error:", e.message);
    return null;
  }
}

async function gcsListByUsername(username) {
  getGCS();
  if (!_bucket) return [];
  try {
    var u = String(username).replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();
    var prefix = PREFIX + u + "/";
    var [files] = await _bucket.getFiles({ prefix: prefix });
    var results = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var [contents] = await files[i].download();
        results.push(JSON.parse(contents.toString("utf8")));
      } catch (e) {
        console.warn("[entryStore] GCS read error for file:", files[i].name, e.message);
      }
    }
    return results;
  } catch (e) {
    console.warn("[entryStore] GCS list error:", e.message);
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new entry.
 * @param {string} entryId
 * @param {string} username
 * @param {string} poolId
 * @returns {Promise<object>} entry
 */
async function createEntry(entryId, username, poolId) {
  var entry = {
    entryId:    entryId,
    username:   username,
    poolId:     poolId,
    createdAt:  new Date().toISOString(),
    lineup:     [],
    salaryUsed: 0,
    updatedAt:  new Date().toISOString(),
  };
  if (BUCKET_NAME) {
    try {
      await gcsWrite(gcsKey(username, entryId), entry);
    } catch (e) {
      console.error("[entryStore] GCS write failed, falling back to memory:", e.message);
      _mem.set(entryId, entry);
    }
  } else {
    _mem.set(entryId, entry);
  }
  return entry;
}

/**
 * Get an entry by entryId.
 * @param {string} entryId
 * @param {string} [username]  optional hint for GCS key lookup
 * @returns {Promise<object|null>}
 */
async function getEntry(entryId, username) {
  if (BUCKET_NAME && username) {
    var obj = await gcsRead(gcsKey(username, entryId));
    if (obj) return obj;
  }
  // Fallback: memory (also covers GCS-less mode)
  return _mem.get(entryId) || null;
}

/**
 * Save (update) the lineup for an entry.
 * @param {string} entryId
 * @param {string} username
 * @param {Array}  lineup     array of player objects { id, name, team, position, cost }
 * @param {number} salaryUsed
 * @returns {Promise<object>} updated entry
 */
async function saveLineup(entryId, username, lineup, salaryUsed) {
  var entry = await getEntry(entryId, username);
  if (!entry) {
    throw new Error("Entry not found: " + entryId);
  }
  entry.lineup     = lineup;
  entry.salaryUsed = salaryUsed;
  entry.updatedAt  = new Date().toISOString();

  if (BUCKET_NAME) {
    try {
      await gcsWrite(gcsKey(entry.username, entryId), entry);
    } catch (e) {
      console.error("[entryStore] GCS write failed on saveLineup:", e.message);
      _mem.set(entryId, entry);
    }
  } else {
    _mem.set(entryId, entry);
  }
  return entry;
}

/**
 * List all entries for a username.
 * @param {string} username
 * @returns {Promise<Array>}
 */
async function getEntriesByUsername(username) {
  if (BUCKET_NAME) {
    var gcsEntries = await gcsListByUsername(username);
    if (gcsEntries.length > 0) return gcsEntries;
  }
  // Memory fallback
  var results = [];
  _mem.forEach(function(entry) {
    if (entry.username === username) results.push(entry);
  });
  return results;
}

module.exports = {
  ENTRY_STORE,
  createEntry,
  getEntry,
  saveLineup,
  getEntriesByUsername,
};
