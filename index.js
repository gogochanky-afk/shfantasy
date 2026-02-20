// /index.js
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// -------------------- config --------------------
const MODE = process.env.DATA_MODE || process.env.MODE || 'LIVE';
const PORT = process.env.PORT || 8080;

// Prefer live JSON if present
const LIVE_POOLS_PATH = process.env.LIVE_POOLS_PATH || path.join(__dirname, 'data', 'pools_live.json');
const LIVE_PLAYERS_PATH = process.env.LIVE_PLAYERS_PATH || path.join(__dirname, 'data', 'players_live.json');

// Cloud Run behind proxy
app.set('trust proxy', 1);

// Body
app.use(express.json({ limit: '1mb' }));

// Static
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function nowIso() {
  return new Date().toISOString();
}
function nowMs() {
  return Date.now();
}

function jsonOk(res, payload) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(payload);
}

function jsonErr(res, code, message, status = 400, extra = {}) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({
    ok: false,
    error: code,
    message,
    mode: MODE,
    ts: nowIso(),
    ...extra,
  });
}

function normalizeUsername(x) {
  const s = String(x || '').trim();
  const cleaned = s.replace(/[^\w.\- ]/g, '').trim(); // allow letters, numbers, space, underscore, dash, dot
  return cleaned.slice(0, 24);
}

// -------------------- demo data (fallback) --------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5, lockAt: null },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5, lockAt: null },
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

// -------------------- load live JSON with fallback --------------------
function safeReadJson(filepath) {
  try {
    if (!fs.existsSync(filepath)) return null;
    const raw = fs.readFileSync(filepath, 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (_) {
    return null;
  }
}

function withLockedFlag(pools) {
  const t = nowMs();
  return (pools || []).map((p) => {
    const lockAt = p.lockAt ? String(p.lockAt) : null;
    let locked = false;
    if (lockAt) {
      const ms = Date.parse(lockAt);
      if (!Number.isNaN(ms)) locked = t >= ms;
    }
    return { ...p, lockAt, locked };
  });
}

function loadPoolsAndPlayers() {
  const livePoolsObj = safeReadJson(LIVE_POOLS_PATH);
  const livePlayersObj = safeReadJson(LIVE_PLAYERS_PATH);

  const livePools = livePoolsObj && Array.isArray(livePoolsObj.pools) ? livePoolsObj.pools : null;
  const livePlayers = livePlayersObj && Array.isArray(livePlayersObj.players) ? livePlayersObj.players : null;

  const pools = withLockedFlag(livePools && livePools.length ? livePools : DEMO_POOLS);
  const players = (livePlayers && livePlayers.length ? livePlayers : DEMO_PLAYERS);

  return { pools, players, source: (livePools && livePlayers) ? 'LIVE_JSON' : 'DEMO_FALLBACK' };
}

let DATA = loadPoolsAndPlayers();

function rebuildIndexes() {
  const poolsById = Object.fromEntries(DATA.pools.map((p) => [p.id, p]));
  const playersById = Object.fromEntries(DATA.players.map((p) => [p.id, p]));
  return { poolsById, playersById };
}

let IDX = rebuildIndexes();

// Optional: allow manual reload without redeploy (admin use)
app.post('/api/admin/reload', (req, res) => {
  DATA = loadPoolsAndPlayers();
  IDX = rebuildIndexes();
  return jsonOk(res, { ok: true, ts: nowIso(), mode: MODE, source: DATA.source });
});

// -------------------- simple persistence (instance-level) --------------------
const STORE_PATH = '/tmp/shfantasy_store.json';

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    }
  } catch (_) {}
  return { entries: {} };
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf-8');
  } catch (_) {}
}

let store = loadStore();

// entry schema:
// { id, username, poolId, players:[], createdAt, updatedAt }
function makeEntryId() {
  return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getEntry(entryId) {
  return store.entries[String(entryId || '')] || null;
}

function upsertEntry(entry) {
  store.entries[entry.id] = entry;
  saveStore(store);
}

function isPoolLocked(pool) {
  if (!pool) return true;
  if (!pool.lockAt) return false;
  const ms = Date.parse(pool.lockAt);
  if (Number.isNaN(ms)) return false;
  return Date.now() >= ms;
}

// -------------------- routes --------------------
app.get('/health', (req, res) => {
  return jsonOk(res, {
    status: 'ok',
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
  });
});

app.get('/api/pools', (req, res) => {
  // refresh locked flags on every call (so it flips without restart)
  const pools = withLockedFlag(DATA.pools);
  DATA.pools = pools;
  IDX = rebuildIndexes();

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    pools,
  });
});

app.get('/api/players', (req, res) => {
  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    players: DATA.players,
  });
});

app.get('/api/join', (req, res) => {
  return res.status(405).json({
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Use POST /api/join with JSON body: { "username": "...", "poolId": "..." }',
    mode: MODE,
    ts: nowIso(),
  });
});

app.post('/api/join', (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const poolId = String((req.body && req.body.poolId) || '').trim();

  if (!username) return jsonErr(res, 'INVALID_USERNAME', 'Username is required.');
  if (!poolId) return jsonErr(res, 'INVALID_POOL', 'poolId is required.');

  // ensure latest pools state
  const pool = IDX.poolsById[poolId];
  if (!pool) return jsonErr(res, 'POOL_NOT_FOUND', 'Pool not found.');

  if (isPoolLocked(pool)) {
    return jsonErr(res, 'POOL_LOCKED', 'Pool is locked. No new entries allowed.', 403, {
      poolId,
      lockAt: pool.lockAt,
    });
  }

  const id = makeEntryId();
  const entry = {
    id,
    username,
    poolId,
    players: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  upsertEntry(entry);

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    entryId: id,
    poolId,
    username,
    redirect: `/draft.html?entryId=${encodeURIComponent(id)}`,
  });
});

app.get('/api/lineup', (req, res) => {
  const entryId = String(req.query.entryId || '').trim();
  if (!entryId) return jsonErr(res, 'MISSING_ENTRY_ID', 'entryId is required.');
  const entry = getEntry(entryId);
  if (!entry) return jsonErr(res, 'ENTRY_NOT_FOUND', 'Entry not found.', 404);

  const pool = IDX.poolsById[entry.poolId] || null;

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    entry,
    pool,
    locked: isPoolLocked(pool),
  });
});

app.post('/api/lineup', (req, res) => {
  const entryId = String((req.body && req.body.entryId) || '').trim();
  const players = (req.body && req.body.players) || [];

  if (!entryId) return jsonErr(res, 'MISSING_ENTRY_ID', 'entryId is required.');
  const entry = getEntry(entryId);
  if (!entry) return jsonErr(res, 'ENTRY_NOT_FOUND', 'Entry not found.', 404);

  const pool = IDX.poolsById[entry.poolId];
  if (!pool) return jsonErr(res, 'POOL_NOT_FOUND', 'Pool not found.');

  if (isPoolLocked(pool)) {
    return jsonErr(res, 'POOL_LOCKED', 'Pool is locked. Lineup cannot be changed.', 403, {
      poolId: pool.id,
      lockAt: pool.lockAt,
    });
  }

  if (!Array.isArray(players)) return jsonErr(res, 'INVALID_PLAYERS', 'players must be an array.');
  const uniq = Array.from(new Set(players.map((x) => String(x).trim()).filter(Boolean)));

  if (uniq.length !== pool.rosterSize) {
    return jsonErr(res, 'ROSTER_SIZE_INVALID', `Must pick exactly ${pool.rosterSize} players.`, 400, {
      rosterSize: pool.rosterSize,
      picked: uniq.length,
    });
  }

  let cost = 0;
  for (const pid of uniq) {
    const p = IDX.playersById[pid];
    if (!p) return jsonErr(res, 'PLAYER_NOT_FOUND', `Player not found: ${pid}`);
    cost += Number(p.cost) || 0;
  }
  if (cost > pool.salaryCap) {
    return jsonErr(res, 'SALARY_CAP_EXCEEDED', `Salary cap exceeded (${cost}/${pool.salaryCap}).`, 400, {
      cost,
      salaryCap: pool.salaryCap,
    });
  }

  entry.players = uniq;
  entry.updatedAt = nowIso();
  upsertEntry(entry);

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    entryId,
    savedPlayers: uniq,
    poolId: pool.id,
  });
});

app.get('/api/my-entries', (req, res) => {
  const username = normalizeUsername(req.query.username);
  if (!username) return jsonErr(res, 'INVALID_USERNAME', 'username is required.');

  const all = Object.values(store.entries || {});
  const entries = all
    .filter((e) => (e.username || '').toLowerCase() === username.toLowerCase())
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    source: DATA.source,
    ts: nowIso(),
    username,
    entries,
    pools: DATA.pools,
  });
});

app.get('/api/document', (req, res) => {
  return jsonErr(res, 'NOT_FOUND', 'API route not found', 404);
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[shfantasy] listening on ${PORT} mode=${MODE} source=${DATA.source}`);
});
