// index.js (repo root) — SH Fantasy Arena API + static site
'use strict';

const path = require('path');
const express = require('express');

const app = express();

// ---------------------------
// Config
// ---------------------------
const MODE = (process.env.DATA_MODE || 'DEMO').toUpperCase(); // DEMO | LIVE
const PORT = process.env.PORT || 8080;

function nowIso() {
  return new Date().toISOString();
}

// Allow JSON + form
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));

// ---------------------------
// Static files
// ---------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// ---------------------------
// Demo data (fallback)
// ---------------------------
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

// ---------------------------
// In-memory entry store (LIVE/DEMO both can use; later swap to DB)
// ---------------------------
/**
 * entriesByUsername: Map<string, Array<Entry>>
 * Entry shape:
 * { id, username, poolId, createdAt, lineup: string[] }
 */
const entriesByUsername = new Map();

function getPools() {
  // TODO: when you plug real pools, replace here
  return DEMO_POOLS;
}

function getPlayers() {
  // TODO: when you plug real players, replace here
  return DEMO_PLAYERS;
}

function normalizeUsername(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  // keep it simple + safe for now
  const cleaned = s.replace(/[^\w\- ]+/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 24);
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

// tolerate multiple key names from frontend (so you won't see "Invalid payload")
function parseJoinPayload(body) {
  const rawUsername = pickFirst(body, ['username', 'user', 'name']);
  const rawPoolId = pickFirst(body, ['poolId', 'pool_id', 'pool', 'poolID', 'id']);

  const username = normalizeUsername(rawUsername);
  const poolId = rawPoolId ? String(rawPoolId).trim() : null;

  return { username, poolId };
}

function makeId(prefix = 'e') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

// ---------------------------
// Health + JSON endpoints (what you were testing)
// ---------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: MODE,
    firestore: false,
    ts: nowIso(),
  });
});

app.get('/pools.json', (req, res) => {
  res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    pools: getPools(),
  });
});

app.get('/players.json', (req, res) => {
  res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    players: getPlayers(),
  });
});

app.get('/my-entries.json', (req, res) => {
  const username = normalizeUsername(req.query.username);
  const entries = username ? (entriesByUsername.get(username) || []) : [];
  res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entries,
  });
});

// ---------------------------
// JOIN API
// ---------------------------

// If someone opens in browser (GET), guide properly (this fixes your "Cannot GET /api/join")
app.get('/api/join', (req, res) => {
  res.status(405).json({
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Use POST /api/join with JSON body: { "username": "...", "poolId": "..." }',
    ts: nowIso(),
  });
});

// Actual join (POST)
app.post('/api/join', (req, res) => {
  const { username, poolId } = parseJoinPayload(req.body);

  if (!username || !poolId) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: 'Missing username or poolId',
      hint: { expected: { username: '...', poolId: '...' }, received: req.body || null },
      ts: nowIso(),
    });
  }

  const pools = getPools();
  const pool = pools.find((p) => p.id === poolId);
  if (!pool) {
    return res.status(404).json({
      ok: false,
      error: 'POOL_NOT_FOUND',
      message: `Unknown poolId: ${poolId}`,
      knownPools: pools.map((p) => p.id),
      ts: nowIso(),
    });
  }

  const entry = {
    id: makeId('entry'),
    username,
    poolId,
    createdAt: nowIso(),
    lineup: [],
  };

  const arr = entriesByUsername.get(username) || [];
  arr.unshift(entry);
  entriesByUsername.set(username, arr);

  return res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry,
    pool,
  });
});

// (Optional) Save lineup endpoint for later wiring
app.post('/api/save-lineup', (req, res) => {
  const username = normalizeUsername(pickFirst(req.body, ['username', 'user', 'name']));
  const entryId = pickFirst(req.body, ['entryId', 'entry_id', 'id']);
  const lineup = pickFirst(req.body, ['lineup', 'players']);

  if (!username || !entryId || !Array.isArray(lineup)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: 'Expected { username, entryId, lineup: [playerId...] }',
      ts: nowIso(),
    });
  }

  const entries = entriesByUsername.get(username) || [];
  const target = entries.find((e) => e.id === String(entryId));
  if (!target) {
    return res.status(404).json({
      ok: false,
      error: 'ENTRY_NOT_FOUND',
      message: `Entry not found: ${entryId}`,
      ts: nowIso(),
    });
  }

  // simple validation: enforce 5 players & cap=10 using current players list
  const players = getPlayers();
  const priceById = new Map(players.map((p) => [p.id, p.cost]));
  const picked = lineup.map(String);

  const cost = picked.reduce((sum, pid) => sum + (priceById.get(pid) || 999), 0);
  if (picked.length !== 5) {
    return res.status(400).json({ ok: false, error: 'INVALID_LINEUP', message: 'Need exactly 5 players', ts: nowIso() });
  }
  if (cost > 10) {
    return res.status(400).json({ ok: false, error: 'OVER_CAP', message: `Cost ${cost} exceeds cap 10`, ts: nowIso() });
  }

  target.lineup = picked;

  return res.json({
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry: target,
    cost,
  });
});

// ---------------------------
// SPA fallback (keep LAST)
// ---------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------
// Start server
// ---------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] listening on :${PORT} mode=${MODE}`);
});
