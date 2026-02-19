// index.js (FULL FILE REPLACEMENT)
// SH Fantasy Arena - Stable Demo Backend (Cloud Run friendly)
// - No Firestore required
// - No URL/UUID pattern parsing that can crash /api/pools
// - Provides: /health, /api/pools, /api/players, /api/join (POST), /api/lineup (GET/POST), /api/my-entries

'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

// -------- Config --------
const PORT = parseInt(process.env.PORT || '8080', 10);
const MODE = (process.env.MODE || 'LIVE').toUpperCase(); // just a label for UI
const FIRESTORE = false; // demo backend

// -------- Middleware --------
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// -------- Static Pages --------
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', etag: true }));

// Optional friendly routes (keeps old links working)
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/draft', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'draft.html')));
app.get('/my-entries', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'my-entries.html')));

// -------- Helpers --------
function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(u) {
  if (!u) return '';
  return String(u).trim().slice(0, 32);
}

function safeId(prefix = 'e') {
  // Node 18+ has randomUUID, but keep compatibility:
  const id = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  return `${prefix}_${id}`;
}

function jsonOk(res, payload) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(payload));
}

function jsonErr(res, code, error, message, extra = {}) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(code).send(JSON.stringify({ ok: false, error, message, ts: nowIso(), ...extra }));
}

// -------- Demo Data (stable, deterministic) --------
const POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 }
];

const PLAYERS = [
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
  { id: 'p16', name: 'Dorian Finney-Smith', team: 'LAL', cost: 1 }
];

const playerCostMap = new Map(PLAYERS.map(p => [p.id, p.cost]));
const poolMap = new Map(POOLS.map(p => [p.id, p]));

// -------- In-memory store (demo) --------
// entriesById: entryId -> entry
// entriesByUser: username -> [entryId, ...]
const entriesById = new Map();
const entriesByUser = new Map();

// -------- API --------

// Health
app.get('/health', (_req, res) => {
  jsonOk(res, {
    status: 'ok',
    mode: MODE,
    firestore: FIRESTORE,
    ts: nowIso()
  });
});

// Pools (THIS is where your crash was. Now it's crash-proof.)
app.get('/api/pools', (_req, res) => {
  jsonOk(res, { ok: true, mode: MODE, ts: nowIso(), pools: POOLS });
});

// Players
app.get('/api/players', (_req, res) => {
  jsonOk(res, { ok: true, mode: MODE, ts: nowIso(), players: PLAYERS });
});

// Join (GET should show guidance)
app.get('/api/join', (_req, res) => {
  jsonErr(
    res,
    405,
    'METHOD_NOT_ALLOWED',
    'Use POST /api/join with JSON body: { "username": "...", "poolId": "..." }'
  );
});

// Join (POST creates an entry)
app.post('/api/join', (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const poolId = req.body && String(req.body.poolId || '').trim();

  if (!username) return jsonErr(res, 400, 'INVALID_PAYLOAD', 'username is required');
  if (!poolId) return jsonErr(res, 400, 'INVALID_PAYLOAD', 'poolId is required');

  const pool = poolMap.get(poolId);
  if (!pool) return jsonErr(res, 404, 'POOL_NOT_FOUND', `poolId not found: ${poolId}`);

  const entryId = safeId('entry');
  const entry = {
    id: entryId,
    username,
    poolId: pool.id,
    players: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  entriesById.set(entryId, entry);
  if (!entriesByUser.has(username)) entriesByUser.set(username, []);
  entriesByUser.get(username).push(entryId);

  // Frontend can redirect to draft.html?entryId=...
  jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entryId,
    pool
  });
});

// Get lineup (draft page loads this)
app.get('/api/lineup', (req, res) => {
  const entryId = String(req.query.entryId || '').trim();
  if (!entryId) return jsonErr(res, 400, 'INVALID_REQUEST', 'entryId is required');

  const entry = entriesById.get(entryId);
  if (!entry) return jsonErr(res, 404, 'ENTRY_NOT_FOUND', 'Entry not found');

  const pool = poolMap.get(entry.poolId) || null;

  jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry,
    pool
  });
});

// Save lineup
app.post('/api/lineup', (req, res) => {
  const entryId = req.body && String(req.body.entryId || '').trim();
  const players = (req.body && req.body.players) || [];

  if (!entryId) return jsonErr(res, 400, 'INVALID_PAYLOAD', 'entryId is required');
  if (!Array.isArray(players)) return jsonErr(res, 400, 'INVALID_PAYLOAD', 'players must be an array');

  const entry = entriesById.get(entryId);
  if (!entry) return jsonErr(res, 404, 'ENTRY_NOT_FOUND', 'Entry not found');

  const pool = poolMap.get(entry.poolId);
  if (!pool) return jsonErr(res, 500, 'POOL_MISSING', 'Pool missing for this entry');

  // Validate roster size
  const unique = Array.from(new Set(players.map(x => String(x))));
  if (unique.length !== pool.rosterSize) {
    return jsonErr(res, 400, 'INVALID_LINEUP', `Pick exactly ${pool.rosterSize} players`);
  }

  // Validate players exist & salary cap
  let totalCost = 0;
  for (const pid of unique) {
    const c = playerCostMap.get(pid);
    if (!c) return jsonErr(res, 400, 'INVALID_PLAYER', `Unknown player id: ${pid}`);
    totalCost += c;
  }
  if (totalCost > pool.salaryCap) {
    return jsonErr(res, 400, 'OVER_CAP', `Salary cap exceeded: ${totalCost}/${pool.salaryCap}`, {
      totalCost,
      salaryCap: pool.salaryCap
    });
  }

  entry.players = unique;
  entry.updatedAt = nowIso();
  entriesById.set(entryId, entry);

  jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry,
    totalCost,
    salaryCap: pool.salaryCap
  });
});

// My entries
app.get('/api/my-entries', (req, res) => {
  const username = normalizeUsername(req.query.username || '');
  if (!username) return jsonErr(res, 400, 'INVALID_REQUEST', 'username is required');

  const ids = entriesByUser.get(username) || [];
  const entries = ids.map(id => entriesById.get(id)).filter(Boolean);

  jsonOk(res, { ok: true, mode: MODE, ts: nowIso(), entries });
});

// -------- Fallback for unknown API --------
app.use('/api', (_req, res) => {
  jsonErr(res, 404, 'NOT_FOUND', 'API route not found');
});

// -------- Start --------
app.listen(PORT, () => {
  console.log(`[shfantasy] listening on :${PORT} mode=${MODE} firestore=${FIRESTORE}`);
});
