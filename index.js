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
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''; // required for admin endpoints

// Optional (future): Sportradar settings (only used if you later wire it)
const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || '';
const SPORTRADAR_BASE_URL = process.env.SPORTRADAR_BASE_URL || ''; // e.g. https://api.sportradar.com/...

// ===== Express =====
app.use(express.json({ limit: '1mb' }));

// ===== GCS client (uses Cloud Run service account) =====
const storage = new Storage();

// Small helper: send consistent JSON errors
function jsonError(res, code, message, extra = {}) {
  return res.status(code).json({ ok: false, message, ...extra });
}

// Admin auth helper
function requireAdmin(req, res) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) {
    jsonError(res, 403, 'ADMIN_TOKEN not configured');
    return false;
  }
  if (token !== ADMIN_TOKEN) {
    jsonError(res, 401, 'Invalid admin token');
    return false;
  }
  return true;
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

async function readJsonIfExists(bucketName, objectPath) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

// Atomic write to destination path: write temp -> copy -> delete temp
async function gcsAtomicWriteJson(bucketName, destPath, dataObj) {
  const bucket = storage.bucket(bucketName);
  const dest = bucket.file(destPath);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const tmpPath = `tmp/${destPath}.${ts}.${Math.random().toString(16).slice(2)}.tmp.json`;
  const tmp = bucket.file(tmpPath);

  const body = JSON.stringify(dataObj, null, 2);

  // 1) write temp
  await tmp.save(body, {
    contentType: 'application/json; charset=utf-8',
    resumable: false,
    metadata: {
      cacheControl: 'no-store, max-age=0',
    },
  });

  // 2) copy temp -> dest (acts like replace)
  await tmp.copy(dest);

  // 3) delete temp
  await tmp.delete({ ignoreNotFound: true });

  return { destPath, tmpPath, bytes: Buffer.byteLength(body, 'utf8') };
}

// Build candidate paths for pools + players
function poolsCandidatePaths() {
  return [
    'pools.json',
    'live/pools.json',
    'data/pools.json',
    'live_data/pools.json',
    'public/pools.json',
  ];
}

function playersCandidatePaths(poolId) {
  return [
    `players/${poolId}.json`,
    `live/players/${poolId}.json`,
    `data/players/${poolId}.json`,
    `${poolId}.json`,
    `live/${poolId}.json`,
    `data/${poolId}.json`,
  ];
}

// ===== ROUTES (define API/health BEFORE any static handlers) =====

// Always-on health endpoint
app.get(['/health.json', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    mode: DATA_MODE,
    bucket: BUCKET_NAME || null,
    ts: new Date().toISOString(),
  });
});

// Simple ping
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ===== NEW: ops endpoint (fix: Cannot GET /api/ops) =====
app.get('/api/ops', async (req, res) => {
  if (DATA_MODE !== 'LIVE') {
    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: 'DEMO',
      ops: {
        last_sync: null,
        note: 'DATA_MODE is not LIVE',
      },
    });
  }

  if (!BUCKET_NAME) return jsonError(res, 500, 'Missing BUCKET_NAME env var');

  try {
    const lastSync = await readJsonIfExists(BUCKET_NAME, 'ops/last_sync.json');
    return res.json({
      ok: true,
      mode: DATA_MODE,
      source: 'GCS:ops/last_sync.json',
      ops: {
        last_sync: lastSync,
      },
    });
  } catch (e) {
    return jsonError(res, 500, 'Failed to read ops from GCS', { error: String(e?.message || e) });
  }
});

// Read pools from GCS (LIVE mode) + DEMO fallback
app.get('/api/pools', async (req, res) => {
  if (DATA_MODE !== 'LIVE') {
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

// Admin check
app.get('/api/admin/check', (req, res) => {
  if (!requireAdmin(req, res)) return;
  return res.json({ ok: true });
});

// ===== NEW: admin sync endpoint (fix: Cannot GET /api/admin/sync) =====
// This endpoint generates a stable pools.json and writes it to GCS atomically.
// For now it generates a safe "DEMO pool list" when Sportradar is not wired.
// Later you can replace generatePoolsPayload() with real Sportradar fetch.
function generatePoolsPayload() {
  // TODO: Replace with Sportradar -> today+tomorrow schedule once wired
  // If you later add Sportradar, keep the SAME output shape to keep frontend stable.
  const now = Date.now();
  return {
    pools: [
      { id: 'demo-pool', name: 'Demo Pool', status: 'open', lockISO: new Date(now + 6 * 3600 * 1000).toISOString() },
    ],
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'admin_sync_demo',
      sportradarConfigured: Boolean(SPORTRADAR_API_KEY && SPORTRADAR_BASE_URL),
    },
  };
}

app.post('/api/admin/sync', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (DATA_MODE !== 'LIVE') {
    return jsonError(res, 400, 'DATA_MODE must be LIVE to sync to GCS', { mode: DATA_MODE });
  }
  if (!BUCKET_NAME) return jsonError(res, 500, 'Missing BUCKET_NAME env var');

  const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';

  try {
    const payload = generatePoolsPayload();

    // Validate minimally
    if (!payload || typeof payload !== 'object') {
      return jsonError(res, 500, 'Generated payload is invalid');
    }

    const ts = new Date().toISOString();
    const historyPath = `history/pools_${ts.replace(/[:.]/g, '-')}.json`;

    if (dryRun) {
      return res.json({
        ok: true,
        mode: DATA_MODE,
        dryRun: true,
        bucket: BUCKET_NAME,
        wouldWrite: ['pools.json', historyPath, 'ops/last_sync.json'],
        preview: payload,
      });
    }

    // 1) Write history snapshot (non-atomic ok, it's append-only)
    await storage.bucket(BUCKET_NAME).file(historyPath).save(JSON.stringify(payload, null, 2), {
      contentType: 'application/json; charset=utf-8',
      resumable: false,
      metadata: { cacheControl: 'no-store, max-age=0' },
    });

    // 2) Atomic replace pools.json (canonical)
    const atomic = await gcsAtomicWriteJson(BUCKET_NAME, 'pools.json', payload);

    // 3) Write ops/last_sync.json
    const lastSync = {
      ok: true,
      ts,
      bucket: BUCKET_NAME,
      wrote: {
        pools: atomic.destPath,
        history: historyPath,
      },
      bytes: atomic.bytes,
      note: 'If you wire Sportradar later, keep pools.json shape stable.',
    };

    await storage.bucket(BUCKET_NAME).file('ops/last_sync.json').save(JSON.stringify(lastSync, null, 2), {
      contentType: 'application/json; charset=utf-8',
      resumable: false,
      metadata: { cacheControl: 'no-store, max-age=0' },
    });

    return res.json({
      ok: true,
      mode: DATA_MODE,
      bucket: BUCKET_NAME,
      wrote: {
        pools: 'pools.json',
        history: historyPath,
        ops: 'ops/last_sync.json',
      },
      lastSync,
    });
  } catch (e) {
    return jsonError(res, 500, 'Failed to sync pools to GCS', { error: String(e?.message || e) });
  }
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
