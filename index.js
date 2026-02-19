// shfantasy/index.js
'use strict';

const path = require('path');
const express = require('express');

let getFirestore;
try {
  // Optional: if firebase.js exists and exports getFirestore()
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  getFirestore = () => null;
}

const app = express();

// --- MUST: parse JSON body for POST ---
app.use(express.json({ limit: '1mb' }));

// -------------------------------
// Static files
// -------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// -------------------------------
// MODE + Firestore
// -------------------------------
const MODE = (process.env.DATA_MODE || process.env.MODE || 'DEMO').toUpperCase();
const db = getFirestore();
const firestoreEnabled = !!db;

// -------------------------------
// Demo pools/players (fallback)
// -------------------------------
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

// -------------------------------
// In-memory entries fallback (when Firestore not available)
// NOTE: This is OK for demo/alpha; Cloud Run instances may reset.
// -------------------------------
const memEntriesByUser = new Map();
// key: username -> array of entries

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(v) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, 40);
}

function normalizePoolId(v) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, 80);
}

// -------------------------------
// Health
// -------------------------------
app.get('/health.json', (req, res) => {
  res.json({
    status: 'ok',
    mode: MODE,
    firestore: firestoreEnabled,
    ts: nowIso(),
  });
});

// -------------------------------
// Pools
// -------------------------------
function getPools() {
  // For now: use demo pools even in LIVE unless you later plug real pools
  return DEMO_POOLS;
}

app.get('/pools.json', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowIso(), pools: getPools() });
});
app.get('/api/pools', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowIso(), pools: getPools() });
});

// -------------------------------
// Players
// -------------------------------
function getPlayers() {
  // For now: demo players; later replace with roster_snapshot query
  return DEMO_PLAYERS;
}

app.get('/players.json', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowIso(), players: getPlayers() });
});
app.get('/api/players', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowIso(), players: getPlayers() });
});

// -------------------------------
// My Entries
// -------------------------------
async function listEntries(username) {
  if (!username) return [];
  if (firestoreEnabled) {
    // If you have a Firestore schema, implement here.
    // To avoid breaking LIVE now, we fallback to memory unless you already built it.
    // return await firestoreListEntries(db, username);
  }
  return memEntriesByUser.get(username) || [];
}

app.get('/my-entries.json', async (req, res) => {
  const username = normalizeUsername(req.query.username || req.query.user || '');
  const entries = await listEntries(username);
  res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
});

app.get('/api/my-entries', async (req, res) => {
  const username = normalizeUsername(req.query.username || req.query.user || '');
  const entries = await listEntries(username);
  res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
});

// -------------------------------
// JOIN
// -------------------------------

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
  // tolerate multiple key names
  const username =
    normalizeUsername(body?.username) ||
    normalizeUsername(body?.user) ||
    normalizeUsername(body?.name);

  const poolId =
    normalizePoolId(body?.poolId) ||
    normalizePoolId(body?.pool_id) ||
    normalizePoolId(body?.pool);

  return { username, poolId };
}

app.post('/api/join', async (req, res) => {
  const { username, poolId } = parseJoinPayload(req.body);

  if (!username || !poolId) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: 'Missing username or poolId',
      got: { username: !!username, poolId: !!poolId },
      ts: nowIso(),
    });
  }

  // basic pool validation
  const pools = getPools();
  const pool = pools.find((p) => p.id === poolId);
  if (!pool) {
    return res.status(404).json({
      ok: false,
      error: 'POOL_NOT_FOUND',
      message: `Unknown poolId: ${poolId}`,
      ts: nowIso(),
    });
  }

  // create entry object
  const entryId = `${poolId}__${username}__${Date.now()}`;
  const entry = {
    id: entryId,
    username,
    poolId,
    createdAt: nowIso(),
    roster: [], // will be filled in draft
    salaryCap: pool.salaryCap,
    rosterSize: pool.rosterSize,
    dataMode: MODE,
    storage: firestoreEnabled ? 'firestore' : 'memory',
  };

  // save (safe fallback)
  try {
    if (firestoreEnabled) {
      // If you already have Firestore collections, implement this section.
      // Example:
      // await db.collection('entries').doc(entryId).set(entry);
      // and maybe user index, etc.
      //
      // For now, to prevent LIVE breaking if Firestore wiring is incomplete:
      // we still fall back to memory unless you confirm schema exists.
      const arr = memEntriesByUser.get(username) || [];
      arr.unshift(entry);
      memEntriesByUser.set(username, arr);
    } else {
      const arr = memEntriesByUser.get(username) || [];
      arr.unshift(entry);
      memEntriesByUser.set(username, arr);
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'JOIN_SAVE_FAILED',
      message: String(e?.message || e),
      ts: nowIso(),
    });
  }

  // return a consistent response the frontend can use
  return res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry,
    // optional: provide draft path for frontend routing
    draftUrl: `/draft?entryId=${encodeURIComponent(entryId)}`,
  });
});

// -------------------------------
// SPA fallback (if you use client-side routing)
// -------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------
// Listen for Cloud Run
// -------------------------------
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`shfantasy server listening on ${PORT} (mode=${MODE}, firestore=${firestoreEnabled})`);
});
