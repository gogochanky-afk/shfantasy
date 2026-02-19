// /index.js
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

let getFirestore;
try {
  // Optional Firestore: provide ./firebase.js exporting { getFirestore }
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  getFirestore = () => null;
}

const app = express();

// IMPORTANT: Cloud Run needs correct PORT
const PORT = Number(process.env.PORT || 8080);

// JSON body
app.use(express.json({ limit: '256kb' }));

// ------------------------------------
// Mode
// ------------------------------------
const MODE = (process.env.DATA_MODE || 'LIVE').toUpperCase(); // LIVE / DEMO
const db = getFirestore();

// ------------------------------------
// Static files
// ------------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// ------------------------------------
// Demo data (safe fallback even in LIVE)
// ------------------------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

const DEMO_PLAYERS = [
  { id: 'p1', name: 'LeBron James', team: 'LAL', cost: 4 },
  { id: 'p2', name: 'Stephen Curry', team: 'GSW', cost: 4 },
  { id: 'p3', name: 'Kevin Durant', team: 'PHX', cost: 4 },
  { id: 'p4', name: 'Jayson Tatum', team: 'BOS', cost: 4 },
  { id: 'p5', name: 'Jalen Brunson', team: 'NYK', cost: 3 },
  { id: 'p6', name: 'Anthony Edwards', team: 'MIN', cost: 3 },
  { id: 'p7', name: 'Devin Booker', team: 'PHX', cost: 3 },
  { id: 'p8', name: 'Donovan Mitchell', team: 'CLE', cost: 3 },
  { id: 'p9', name: 'Mikal Bridges', team: 'NYK', cost: 2 },
  { id: 'p10', name: 'Derrick White', team: 'BOS', cost: 2 },
  { id: 'p11', name: 'Austin Reaves', team: 'LAL', cost: 2 },
  { id: 'p12', name: 'Klay Thompson', team: 'DAL', cost: 2 },
  { id: 'p13', name: 'Alex Caruso', team: 'OKC', cost: 1 },
  { id: 'p14', name: 'Josh Hart', team: 'NYK', cost: 1 },
  { id: 'p15', name: 'Naz Reid', team: 'MIN', cost: 1 },
  { id: 'p16', name: 'Dorian Finney-Smith', team: 'LAL', cost: 1 },
];

// ------------------------------------
// Tiny file store fallback (works without Firestore)
// Cloud Run instance storage is ephemeral but good enough for MVP
// ------------------------------------
const STORE_PATH = process.env.ENTRIES_STORE_PATH || '/tmp/shfantasy_entries.json';

function safeReadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { entries: [] };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const obj = JSON.parse(raw || '{}');
    if (!obj || typeof obj !== 'object') return { entries: [] };
    if (!Array.isArray(obj.entries)) obj.entries = [];
    return obj;
  } catch (e) {
    return { entries: [] };
  }
}

function safeWriteStore(obj) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(s) {
  if (typeof s !== 'string') return '';
  const v = s.trim();
  // keep simple, avoid weird chars breaking UI
  return v.slice(0, 30);
}

function normalizePoolId(s) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, 60);
}

function getPools() {
  // For now: even LIVE returns demo pools (until real schedule/pools hooked)
  return DEMO_POOLS;
}

function getPlayers(/* poolId */) {
  // For now: demo player set for all pools
  return DEMO_PLAYERS;
}

function makeEntryId() {
  return `e_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

// ------------------------------------
// APIs
// ------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: MODE,
    firestore: !!db,
    ts: nowIso(),
  });
});

app.get('/api/pools', (req, res) => {
  res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    pools: getPools(),
  });
});

app.get('/api/players', (req, res) => {
  const poolId = normalizePoolId(req.query.poolId || '');
  res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    players: getPlayers(poolId),
  });
});

app.get('/api/my-entries', async (req, res) => {
  const username = normalizeUsername(req.query.username || '');
  if (!username) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_USERNAME',
      message: 'Provide ?username=...',
      ts: nowIso(),
    });
  }

  // Firestore optional
  if (db) {
    try {
      const snap = await db
        .collection('entries')
        .where('username', '==', username)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const entries = [];
      snap.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));
      return res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
    } catch (e) {
      // fallthrough to file store
    }
  }

  const store = safeReadStore();
  const entries = store.entries
    .filter((e) => e.username === username)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 50);

  return res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
});

// If someone opens in browser (GET), guide them properly
app.get('/api/join', (req, res) => {
  res.status(405).json({
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Use POST /api/join with JSON body: { "username": "...", "poolId": "..." }',
    ts: nowIso(),
  });
});

function parseJoinPayload(body) {
  // tolerate multiple key names (front-end may change)
  const username =
    normalizeUsername(body?.username) ||
    normalizeUsername(body?.user) ||
    normalizeUsername(body?.name) ||
    normalizeUsername(body?.handle);

  const poolId =
    normalizePoolId(body?.poolId) ||
    normalizePoolId(body?.pool) ||
    normalizePoolId(body?.pool_id) ||
    normalizePoolId(body?.poolID);

  // optional: allow "today" / "tomorrow"
  let normalizedPoolId = poolId;
  if (poolId === 'today') normalizedPoolId = 'demo-today';
  if (poolId === 'tomorrow') normalizedPoolId = 'demo-tomorrow';

  return { username, poolId: normalizedPoolId };
}

function validateJoin({ username, poolId }) {
  if (!username) return { ok: false, code: 'INVALID_USERNAME', message: 'username is required' };
  if (!poolId) return { ok: false, code: 'INVALID_POOL', message: 'poolId is required' };

  const pools = getPools();
  const found = pools.find((p) => p.id === poolId);
  if (!found) return { ok: false, code: 'POOL_NOT_FOUND', message: `Unknown poolId: ${poolId}` };

  return { ok: true, pool: found };
}

app.post('/api/join', async (req, res) => {
  const parsed = parseJoinPayload(req.body || {});
  const v = validateJoin(parsed);

  if (!v.ok) {
    return res.status(400).json({
      ok: false,
      error: v.code,
      message: v.message,
      received: {
        keys: Object.keys(req.body || {}),
        username: parsed.username || null,
        poolId: parsed.poolId || null,
      },
      expected: { username: 'string', poolId: 'string' },
      ts: nowIso(),
    });
  }

  const entry = {
    id: makeEntryId(),
    username: parsed.username,
    poolId: parsed.poolId,
    createdAt: nowIso(),
    // Draft payload placeholder (lineup saved later)
    lineup: [],
    salaryCap: v.pool.salaryCap,
    rosterSize: v.pool.rosterSize,
  };

  // Firestore optional
  if (db) {
    try {
      const ref = await db.collection('entries').add(entry);
      return res.json({
        ok: true,
        mode: MODE,
        ts: nowIso(),
        entryId: ref.id,
        entry: { ...entry, id: ref.id },
        // Frontend can open draft by entryId
        draftUrl: `/draft.html?entryId=${encodeURIComponent(ref.id)}`,
      });
    } catch (e) {
      // fallthrough to file store
    }
  }

  const store = safeReadStore();
  store.entries.unshift(entry);
  safeWriteStore(store);

  return res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entryId: entry.id,
    entry,
    draftUrl: `/draft.html?entryId=${encodeURIComponent(entry.id)}`,
  });
});

// ------------------------------------
// SPA fallback (optional): if you have client-side routing later
// ------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------
// Start server
// ------------------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] listening on ${PORT} mode=${MODE} firestore=${!!db}`);
});
