'use strict';

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

const BUCKET = process.env.ENTRY_BUCKET;
const PREFIX = 'entries/';

// Export store type for healthz
const ENTRY_STORE = BUCKET ? 'GCS' : 'MEMORY';
module.exports.ENTRY_STORE = ENTRY_STORE;

// In-memory fallback when no bucket configured
const _mem = new Map();

function ensureBucket() {
  if (!BUCKET) {
    const e = new Error('Missing ENTRY_BUCKET env var');
    e.code = 'MISSING_ENTRY_BUCKET';
    throw e;
  }
}

function getFile(entryId) {
  ensureBucket();
  return storage.bucket(BUCKET).file(PREFIX + entryId + '.json');
}

async function saveEntry(entry) {
  if (!BUCKET) {
    // fallback: in-memory
    _mem.set(entry.entryId, entry);
    return;
  }
  const file = getFile(entry.entryId);
  await file.save(JSON.stringify(entry, null, 2), {
    contentType: 'application/json',
  });
}

async function getEntriesByUser(userId) {
  if (!BUCKET) {
    // fallback: in-memory scan
    const results = [];
    for (const entry of _mem.values()) {
      if (entry && entry.userId === userId) results.push(entry);
    }
    results.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return results;
  }

  const [files] = await storage.bucket(BUCKET).getFiles({ prefix: PREFIX });

  const results = [];
  for (const f of files) {
    const [data] = await f.download();
    const entry = JSON.parse(data.toString('utf8'));
    if (entry && entry.userId === userId) results.push(entry);
  }

  // newest first
  results.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return results;
}

module.exports.saveEntry = saveEntry;
module.exports.getEntriesByUser = getEntriesByUser;
