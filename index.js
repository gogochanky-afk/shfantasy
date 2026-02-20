// /index.js
'use strict';

const path = require('path');
const express = require('express');
const { Storage } = require('@google-cloud/storage');

const app = express();

// ===== ENV =====
const PORT = Number(process.env.PORT || 8080);
const DATA_MODE = (process.env.DATA_MODE || 'DEMO').toUpperCase(); // LIVE / DEMO
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // optional, avoid hardcoding secrets

// ===== GCS client (uses Cloud Run service account) =====
const storage = new Storage();

// Small helper: send consistent JSON errors
function jsonError(res, code, message, extra = {}) {
  return res.status(code).json({ ok: false, message, ...extra });
}

// Try multiple object paths until one exists
async function readFirstExistingObject(bucketName, candidatePaths) {
  const bucket = storage.bucket(bucketName);

  for (const objectPath of candidatePaths) {
    const file = bucket.file(objectPath);
    // eslint-disable-next-line no-await-in-loop
    const [exists] = await file.exists();
    if (!exists) continue;

    // eslint-disable-next-line no-await-in-loop
    const [buf] = await file.download();
    return { objectPath, text: buf.toString('utf8') };
  }

  return null;
}

// Build candidate paths for pools + players
function poolsCandidatePaths() {
  // You can adjust your final canonical path later; now we support several.
  return [
    'pools.json',
    'live/pools.json',
    'data/pools.json',
    'live_data/pools.json',
    'public/pools.json',
  ];
}

function playersCandidatePaths(poolId) {
  // poolId examples: sr_game_12345 or actual sr_game_id
  return [
    `players/${poolId}.json`,
    `live/players/${poolId}.json`,
    `data/players/${poolId}.json`,
    `${poolId}.json`,
    `live/${poolId}.json`,
    `data/${poolId}.json`,
  ];
}

// ===== ROUTES (IMPORTANT: define API/health BEFORE any static handlers) =====

// Always-on health endpoint
app.get(['/health.json', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    mode: DATA_MODE,
    bucket: BUCKET_NAME || null,
    ts: new Date().toISOString(),
  });
});

// Optional simple root ping (useful for quick checks)
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Read pools from GCS (LIVE mode) with fallback message if not found
app.get('/api/pools', async (req, res) => {
  if (DATA_MODE !== 'LIVE') {
    // DEMO mode: return a tiny safe payload
    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: 'DEMO',
      pools: [
        { id: 'sr_game_12345', title: 'LAL @ BOS', lockISO: new Date(Date.now() + 24 * 3600 * 1000).toISOString() },
        { id: 'sr_game_67890', title: 'NYK @ CLE', lockISO: new Date(Date.now() + 48 * 3600 * 1000).toISOString() },
      ],
    });
  }

  if (!BUCKET_NAME) return jsonError(res, 500, 'Missing BUCKET_NAME env var');

  try {
    const found = await readFirstExistingObject(BUCKET_NAME, poolsCandidatePaths());
    if (!found) {
      return jsonError(res, 404, 'pools.json not found in bucket', { tried: poolsCandidatePaths() });
    }

    let pools;
    try {
      pools = JSON.parse(found.text);
    } catch (e) {
      return jsonError(res, 500, 'pools.json is not valid JSON', { objectPath: found.objectPath });
    }

    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: `GCS:${found.objectPath}`,
      pools,
    });
  } catch (e) {
    return jsonError(res, 500, 'Failed to read pools from GCS', { error: String(e?.message || e) });
  }
});

// Read players for a pool from GCS
app.get('/api/pool/:poolId/players', async (req, res) => {
  const { poolId } = req.params;

  if (DATA_MODE !== 'LIVE') {
    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: 'DEMO',
      poolId,
      players: [
        { name: 'LeBron James', team: 'LAL', cost: 4 },
        { name: 'Jayson Tatum', team: 'BOS', cost: 4 },
        { name: 'Jalen Brunson', team: 'NYK', cost: 3 },
        { name: 'Donovan Mitchell', team: 'CLE', cost: 3 },
      ],
    });
  }

  if (!BUCKET_NAME) return jsonError(res, 500, 'Missing BUCKET_NAME env var');

  try {
    const candidates = playersCandidatePaths(poolId);
    const found = await readFirstExistingObject(BUCKET_NAME, candidates);

    if (!found) {
      return jsonError(res, 404, 'players file not found in bucket', { poolId, tried: candidates });
    }

    let players;
    try {
      players = JSON.parse(found.text);
    } catch (e) {
      return jsonError(res, 500, 'players file is not valid JSON', { objectPath: found.objectPath, poolId });
    }

    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: `GCS:${found.objectPath}`,
      poolId,
      players,
    });
  } catch (e) {
    return jsonError(res, 500, 'Failed to read players from GCS', { error: String(e?.message || e), poolId });
  }
});

// (Optional) protect admin endpoints with token if you add later
app.get('/api/admin/check', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) return jsonError(res, 403, 'ADMIN_TOKEN not configured');
  if (token !== ADMIN_TOKEN) return jsonError(res, 401, 'Invalid admin token');
  return res.json({ ok: true });
});

// ===== STATIC (only if /public exists) =====
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// If user hits "/", try to serve public/index.html; otherwise plain text.
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.type('text').send('SH Fantasy Live');
  });
});

// ===== START =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (mode=${DATA_MODE})`);
});
