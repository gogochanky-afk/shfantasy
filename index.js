// /index.js
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

const MODE = (process.env.DATA_MODE || process.env.MODE || 'DEMO').toUpperCase(); // 'LIVE' | 'DEMO'
const PORT = parseInt(process.env.PORT || '8080', 10);

// ------------------------------
// Helpers
// ------------------------------
function nowIso() {
  return new Date().toISOString();
}

function send(res, status, obj) {
  res.status(status).json(obj);
}

function normalizeUsername(v) {
  if (!v) return '';
  return String(v).trim().slice(0, 32);
}

function normalizePoolId(v) {
  if (!v) return '';
  return String(v).trim().slice(0, 64);
}

function readJsonFileSafe(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    const txt = fs.readFileSync(absPath, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

/**
 * We support these data locations (first hit wins):
 * 1) ./db/pools.json , ./db/players.json
 * 2) ./public/pools.json , ./public/players.json
 * 3) ./routes or other – (not assumed)
 */
function loadPools() {
  const candidates = [
    path.join(__dirname, 'db', 'pools.json'),
    path.join(__dirname, 'public', 'pools.json'),
  ];
  for (const p of candidates) {
    const j = readJsonFileSafe(p);
    if (j && (Array.isArray(j.pools) || Array.isArray(j))) return j.pools || j;
  }

  // fallback demo
  return [
    { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
    { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
  ];
}

function loadPlayers() {
  const candidates = [
    path.join(__dirname, 'db', 'players.json'),
    path.join(__dirname, 'public', 'players.json'),
  ];
  for (const p of candidates) {
    const j = readJsonFileSafe(p);
    if (j && (Array.isArray(j.players) || Array.isArray(j))) return j.players || j;
  }

  // fallback demo players
  return [
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
}

function parseJoinPayload(body) {
  // tolerate multiple key names
  const username =
    normalizeUsername(body?.username) ||
    normalizeUsername(body?.user) ||
    normalizeUsername(body?.name);

  const poolId =
    normalizePoolId(body?.poolId) ||
    normalizePoolId(body?.pool_id) ||
    normalizePoolId(body?.pool) ||
    normalizePoolId(body?.id);

  return { username, poolId };
}

// Minimal in-memory entries (Cloud Run is ephemeral; OK for alpha demo)
const entriesStore = new Map(); // key = username, value = array of entries

function listEntries(username) {
  return entriesStore.get(username) || [];
}

function saveEntry(username, entry) {
  const cur = entriesStore.get(username) || [];
  cur.unshift(entry);
  entriesStore.set(username, cur.slice(0, 50)); // keep last 50
}

// ------------------------------
// API ROUTES FIRST (Important)
// ------------------------------

// Health (API)
app.get(['/health', '/api/health'], (req, res) => {
  return send(res, 200, {
    status: 'ok',
    mode: MODE,
    firestore: false,
    ts: nowIso(),
  });
});

// Pools
app.get(['/api/pools', '/pools.json'], (req, res) => {
  const pools = loadPools();
  return send(res, 200, { ok: true, mode: MODE, ts: nowIso(), pools });
});

// Players
app.get(['/api/players', '/players.json'], (req, res) => {
  const players = loadPlayers();
  return send(res, 200, { ok: true, mode: MODE, ts: nowIso(), players });
});

// My entries
app.get(['/api/my-entries', '/my-entries.json'], (req, res) => {
  const username = normalizeUsername(req.query?.username || req.headers['x-username']);
  if (!username) {
    return send(res, 200, { ok: true, mode: MODE, ts: nowIso(), entries: [] });
  }
  return send(res, 200, { ok: true, mode: MODE, ts: nowIso(), entries: listEntries(username) });
});

// Join (GET guide)
app.get('/api/join', (req, res) => {
  return send(res, 405, {
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Use POST /api/join with JSON body: { "username":"...", "poolId":"..." }',
    ts: nowIso(),
  });
});

// Join (POST)
app.post('/api/join', (req, res) => {
  const { username, poolId } = parseJoinPayload(req.body || {});
  if (!username || !poolId) {
    return send(res, 400, {
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: 'Missing username or poolId',
      got: { username: username || null, poolId: poolId || null },
      ts: nowIso(),
    });
  }

  const pools = loadPools();
  const pool = pools.find((p) => String(p.id) === String(poolId));
  if (!pool) {
    return send(res, 404, {
      ok: false,
      error: 'POOL_NOT_FOUND',
      message: `Pool not found: ${poolId}`,
      ts: nowIso(),
    });
  }

  // Return pool + a simple token for front-end (alpha)
  return send(res, 200, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    join: {
      username,
      poolId: pool.id,
      pool,
      token: Buffer.from(`${username}:${pool.id}`).toString('base64'),
    },
  });
});

// Save lineup / entry
app.post('/api/save-entry', (req, res) => {
  const username = normalizeUsername(req.body?.username || req.body?.user || req.headers['x-username']);
  const poolId = normalizePoolId(req.body?.poolId || req.body?.pool_id || req.body?.pool);
  const picks = Array.isArray(req.body?.picks) ? req.body.picks : null;

  if (!username || !poolId || !picks) {
    return send(res, 400, {
      ok: false,
      error: 'INVALID_PAYLOAD',
      message: 'Expected { username, poolId, picks: [playerIds...] }',
      ts: nowIso(),
    });
  }

  const pool = loadPools().find((p) => String(p.id) === String(poolId));
  if (!pool) {
    return send(res, 404, {
      ok: false,
      error: 'POOL_NOT_FOUND',
      message: `Pool not found: ${poolId}`,
      ts: nowIso(),
    });
  }

  const players = loadPlayers();
  const pickedPlayers = picks
    .map((id) => players.find((pp) => String(pp.id) === String(id)))
    .filter(Boolean);

  // Validate roster size & cap (Daily Blitz invariant)
  const rosterSize = Number(pool.rosterSize || 5);
  const salaryCap = Number(pool.salaryCap || 10);

  if (pickedPlayers.length !== rosterSize) {
    return send(res, 400, {
      ok: false,
      error: 'INVALID_LINEUP',
      message: `Need exactly ${rosterSize} players`,
      ts: nowIso(),
    });
  }

  const cost = pickedPlayers.reduce((sum, p) => sum + Number(p.cost || 0), 0);
  if (cost > salaryCap) {
    return send(res, 400, {
      ok: false,
      error: 'CAP_EXCEEDED',
      message: `Salary cap exceeded: ${cost}/${salaryCap}`,
      ts: nowIso(),
    });
  }

  const entry = {
    id: `e_${Date.now()}`,
    username,
    poolId,
    picks: pickedPlayers.map((p) => ({ id: p.id, name: p.name, team: p.team, cost: p.cost })),
    cost,
    createdAt: nowIso(),
  };

  saveEntry(username, entry);

  return send(res, 200, { ok: true, mode: MODE, ts: nowIso(), entry });
});

// ------------------------------
// Static + SPA fallback (AFTER API)
// ------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// SPA fallback: serve index.html for non-API GETs
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return send(res, 404, { ok: false, error: 'NOT_FOUND', path: req.path, ts: nowIso() });
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------
// Listen
// ------------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] listening on :${PORT} mode=${MODE} ts=${nowIso()}`);
});
