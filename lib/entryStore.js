'use strict';

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

const BUCKET = process.env.ENTRY_BUCKET;
const PREFIX = 'entries/';

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
  const file = getFile(entry.entryId);
  await file.save(JSON.stringify(entry, null, 2), {
    contentType: 'application/json',
  });
}

async function getEntriesByUser(userId) {
  ensureBucket();
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

module.exports = { saveEntry, getEntriesByUser };
