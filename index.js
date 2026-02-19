// shfantasy/index.js
'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

let getFirestore;
try {
  // Optional: if you have ./firebase.js exporting { getFirestore }
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  // Fallback: run even if firebase is not configured
  getFirestore = () => null;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// ------------------------------
// Config
// ------------------------------
const PORT = Number(process.env.PORT || 8080);
const DATA_MODE = String(process.env.DATA_MODE || 'DEMO').toUpperCase(); // DEMO | LIVE
const APP_URL = process.env.APP_URL || ''; // optional (not required)

// ------------------------------
// Static files
// ------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// ------------------------------
// Storage layer (Firestore optional)
// ------------------------------
const db = getFirestore();

// In-memory fallback (Cloud Run is stateless; OK for dev)
const MEM = {
  entries: new Map(), // entryId -> entry
};

function nowISO() {
  return new Date().toISOString();
}

function safeStr(x, fallback = '') {
  if (typeof x === 'string') return x.trim();
  return fallback;
}

function jsonError(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
    ts: nowISO(),
    mode: DATA_MODE,
  });
}

function makeEntryId(user, poolId) {
  // Deterministic per (user,poolId) so user can "resume" draft
  const raw = `${user}__${poolId}`.toLowerCase();
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
  return `e_${hash}`;
}

async function saveEntry(entry) {
  if (db) {
    await db.collection('entries').doc(entry.id).set(entry, { merge: true });
    return;
  }
  MEM.entries.set(entry.id, entry);
}

async function getEntry(entryId) {
  if (db) {
    const snap = await db.collection('entries').doc(entryId).get();
    return snap.exists ? snap.data() : null;
  }
  return MEM.entries.get(entryId) || null;
}

async function listEntriesByUser(user) {
  if (db) {
    const qs = await db.collection('entries').where('user', '==', user).get();
    const items = [];
    qs.forEach((doc) => items.push(doc.data()));
    // newest first
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return items;
  }
  const items = [];
  for (const e of MEM.entries.values()) {
    if (e.user === user) items.push(e);
  }
  items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return items;
}

// ------------------------------
// Demo pools + demo players (used for now in both DEMO & LIVE)
// Later we will replace with real pools/players (Sportradar + roster snapshots)
// ------------------------------
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

// quick lookup for validation
function getPoolById(poolId) {
  return DEMO_POOLS.find((p) => p.id === poolId) || null;
}
function getPlayerById(pid) {
  return DEMO_PLAYERS.find((p) => p.id === pid) || null;
}

function calcLineupCost(playerIds) {
  let sum = 0;
  for (const pid of playerIds) {
    const pl = getPlayerById(pid);
    if (!pl) return null; // invalid player id
    sum += Number(pl.cost || 0);
  }
  return sum;
}

// ------------------------------
// Health + API
// ------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: DATA_MODE,
    firestore: !!db,
    ts: nowISO(),
  });
});

// Backward compatible endpoints (non-/api)
app.get('/pools', (req, res) => res.redirect(302, '/api/pools'));
app.get('/players', (req, res) => res.redirect(302, '/api/players'));
app.get('/my-entries', (req, res) => res.redirect(302, '/api/my-entries'));

// Pools
app.get('/api/pools', (req, res) => {
  res.json({
    ok: true,
    mode: DATA_MODE,
    ts: nowISO(),
    pools: DEMO_POOLS,
  });
});

// Players
app.get('/api/players', (req, res) => {
  res.json({
    ok: true,
    mode: DATA_MODE,
    ts: nowISO(),
    players: DEMO_PLAYERS,
  });
});

// My Entries
// GET /api/my-entries?user=Hugo
app.get('/api/my-entries', async (req, res) => {
  const user = safeStr(req.query.user, '');
  if (!user) return jsonError(res, 400, 'MISSING_USER', 'Query param "user" is required.');

  try {
    const entries = await listEntriesByUser(user);
    return res.json({
      ok: true,
      mode: DATA_MODE,
      ts: nowISO(),
      entries,
    });
  } catch (e) {
    return jsonError(res, 500, 'MY_ENTRIES_FAILED', 'Failed to load entries.', { detail: String(e?.message || e) });
  }
});

// Join (create or resume a draft entry)
// POST /api/join  { user, poolId }
app.post('/api/join', async (req, res) => {
  const user = safeStr(req.body?.user, '');
  const poolId = safeStr(req.body?.poolId, '');

  if (!user) return jsonError(res, 400, 'MISSING_USER', 'Body field "user" is required.');
  if (!poolId) return jsonError(res, 400, 'MISSING_POOL_ID', 'Body field "poolId" is required.');

  const pool = getPoolById(poolId);
  if (!pool) return jsonError(res, 404, 'POOL_NOT_FOUND', 'Pool not found.', { poolId });

  const entryId = makeEntryId(user, poolId);

  try {
    const existing = await getEntry(entryId);
    const base = existing || {
      id: entryId,
      user,
      poolId,
      status: 'DRAFT', // DRAFT | SUBMITTED
      playerIds: [],
      totalCost: 0,
      rosterSize: pool.rosterSize,
      salaryCap: pool.salaryCap,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      dataMode: DATA_MODE,
    };

    base.updatedAt = nowISO();
    await saveEntry(base);

    return res.json({
      ok: true,
      mode: DATA_MODE,
      ts: nowISO(),
      entry: base,
    });
  } catch (e) {
    return jsonError(res, 500, 'JOIN_FAILED', 'Failed to join pool.', { detail: String(e?.message || e) });
  }
});

// Submit entry (validate salary cap + roster size)
// POST /api/submit-entry { user, poolId, playerIds }
// Note: entryId is optional; server will re-derive deterministic entryId if omitted
app.post('/api/submit-entry', async (req, res) => {
  const user = safeStr(req.body?.user, '');
  const poolId = safeStr(req.body?.poolId, '');
  const playerIds = Array.isArray(req.body?.playerIds) ? req.body.playerIds.map((x) => safeStr(x, '')).filter(Boolean) : [];

  if (!user) return jsonError(res, 400, 'MISSING_USER', 'Body field "user" is required.');
  if (!poolId) return jsonError(res, 400, 'MISSING_POOL_ID', 'Body field "poolId" is required.');
  if (!playerIds.length) return jsonError(res, 400, 'MISSING_PLAYER_IDS', 'Body field "playerIds" must be a non-empty array.');

  const pool = getPoolById(poolId);
  if (!pool) return jsonError(res, 404, 'POOL_NOT_FOUND', 'Pool not found.', { poolId });

  // Enforce roster size
  if (playerIds.length !== pool.rosterSize) {
    return jsonError(res, 400, 'INVALID_ROSTER_SIZE', `Lineup must have exactly ${pool.rosterSize} players.`, {
      expected: pool.rosterSize,
      got: playerIds.length,
    });
  }

  // Unique players
  const uniq = new Set(playerIds);
  if (uniq.size !== playerIds.length) {
    return jsonError(res, 400, 'DUPLICATE_PLAYERS', 'Lineup contains duplicate players.');
  }

  // Validate all players exist + compute cost
  const totalCost = calcLineupCost(playerIds);
  if (totalCost === null) {
    return jsonError(res, 400, 'INVALID_PLAYER_ID', 'Lineup contains an unknown player id.');
  }

  // Enforce salary cap
  if (totalCost > pool.salaryCap) {
    return jsonError(res, 400, 'SALARY_CAP_EXCEEDED', 'Total cost exceeds salary cap.', {
      salaryCap: pool.salaryCap,
      totalCost,
    });
  }

  const entryId = safeStr(req.body?.entryId, '') || makeEntryId(user, poolId);

  try {
    const existing = await getEntry(entryId);
    const entry = existing || {
      id: entryId,
      user,
      poolId,
      status: 'DRAFT',
      playerIds: [],
      totalCost: 0,
      rosterSize: pool.rosterSize,
      salaryCap: pool.salaryCap,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      dataMode: DATA_MODE,
    };

    entry.playerIds = playerIds;
    entry.totalCost = totalCost;
    entry.status = 'SUBMITTED';
    entry.updatedAt = nowISO();
    entry.dataMode = DATA_MODE;

    await saveEntry(entry);

    return res.json({
      ok: true,
      mode: DATA_MODE,
      ts: nowISO(),
      entry,
    });
  } catch (e) {
    return jsonError(res, 500, 'SUBMIT_FAILED', 'Failed to submit entry.', { detail: String(e?.message || e) });
  }
});

// Read entry by id (debug)
app.get('/api/entry/:id', async (req, res) => {
  const id = safeStr(req.params.id, '');
  if (!id) return jsonError(res, 400, 'MISSING_ENTRY_ID', 'Entry id is required.');

  try {
    const entry = await getEntry(id);
    if (!entry) return jsonError(res, 404, 'ENTRY_NOT_FOUND', 'Entry not found.', { id });

    return res.json({
      ok: true,
      mode: DATA_MODE,
      ts: nowISO(),
      entry,
    });
  } catch (e) {
    return jsonError(res, 500, 'ENTRY_READ_FAILED', 'Failed to read entry.', { detail: String(e?.message || e) });
  }
});

// ------------------------------
// SPA fallback (if you have index.html in /public)
// ------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------
// Start server (Cloud Run requires listening on process.env.PORT)
// ------------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] server listening on port ${PORT}, mode=${DATA_MODE}, firestore=${!!db}, app_url=${APP_URL}`);
});
