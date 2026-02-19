// index.js
'use strict';

const path = require('path');
const express = require('express');

let getFirestore;
try {
  // If you have ./firebase.js in your repo (as your screenshot implies), we use it.
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  // Fallback: run even if firebase is not configured (DEMO mode)
  getFirestore = () => null;
}

const app = express();
app.use(express.json());

// ---------------------------
// Static files
// ---------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
}));

// ---------------------------
// Firestore (optional)
// ---------------------------
const db = getFirestore();

// ---------------------------
// Demo data
// ---------------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

// mixed costs 1–4
const DEMO_PLAYERS = [
  // cost 4 (stars)
  { id: 'p1', name: 'Nikola Jokic', cost: 4 },
  { id: 'p2', name: 'Luka Doncic', cost: 4 },
  { id: 'p3', name: 'Giannis Antetokounmpo', cost: 4 },
  { id: 'p4', name: 'Shai Gilgeous-Alexander', cost: 4 },
  { id: 'p5', name: 'Joel Embiid', cost: 4 },

  // cost 3 (all-stars)
  { id: 'p6', name: 'Stephen Curry', cost: 3 },
  { id: 'p7', name: 'Kevin Durant', cost: 3 },
  { id: 'p8', name: 'Jayson Tatum', cost: 3 },
  { id: 'p9', name: 'LeBron James', cost: 3 },
  { id: 'p10', name: 'Anthony Davis', cost: 3 },
  { id: 'p11', name: 'Kyrie Irving', cost: 3 },

  // cost 2 (solid)
  { id: 'p12', name: 'Jalen Brunson', cost: 2 },
  { id: 'p13', name: 'Devin Booker', cost: 2 },
  { id: 'p14', name: 'Ja Morant', cost: 2 },
  { id: 'p15', name: 'Jimmy Butler', cost: 2 },
  { id: 'p16', name: 'Bam Adebayo', cost: 2 },

  // cost 1 (value)
  { id: 'p17', name: 'Derrick White', cost: 1 },
  { id: 'p18', name: 'Alex Caruso', cost: 1 },
  { id: 'p19', name: 'Josh Hart', cost: 1 },
  { id: 'p20', name: 'Herb Jones', cost: 1 },
  { id: 'p21', name: 'Walker Kessler', cost: 1 },
];

// ---------------------------
// Simple helpers
// ---------------------------
function nowIso() {
  return new Date().toISOString();
}

function safeUsername(req) {
  // Demo default; later can wire auth
  const u = (req.query.username || req.body?.username || 'Hugo').toString().trim();
  return u || 'Hugo';
}

// ---------------------------
// Health endpoints (for Cloud Run + your own checking)
// ---------------------------
app.get('/health.json', (req, res) => {
  res.status(200).json({ status: 'ok', ts: nowIso() });
});

app.get('/my-entries.json', async (req, res) => {
  // Keep compatible with your screenshot: {"ok":true,"mode":"DEMO","username":"Hugo","entries":[]}
  const username = safeUsername(req);
  res.status(200).json({ ok: true, mode: 'DEMO', username, entries: [] });
});

// ---------------------------
// API: pools & players (DEMO for now)
// ---------------------------
app.get('/api/pools', async (req, res) => {
  res.json({
    ok: true,
    mode: 'DEMO',
    ts: nowIso(),
    pools: DEMO_POOLS,
  });
});

app.get('/api/pool/:poolId', async (req, res) => {
  const poolId = req.params.poolId;
  const pool = DEMO_POOLS.find(p => p.id === poolId);
  if (!pool) {
    return res.status(404).json({ ok: false, error: 'POOL_NOT_FOUND', poolId });
  }
  res.json({
    ok: true,
    mode: 'DEMO',
    pool,
    players: DEMO_PLAYERS,
    ts: nowIso(),
  });
});

// ---------------------------
// API: join (idempotent placeholder)
// ---------------------------
app.post('/api/join', async (req, res) => {
  const username = safeUsername(req);
  const { poolId, playerIds } = req.body || {};

  // Minimal validation
  if (!poolId) return res.status(400).json({ ok: false, error: 'MISSING_POOL_ID' });
  if (!Array.isArray(playerIds)) return res.status(400).json({ ok: false, error: 'MISSING_PLAYER_IDS' });

  const pool = DEMO_POOLS.find(p => p.id === poolId);
  if (!pool) return res.status(404).json({ ok: false, error: 'POOL_NOT_FOUND', poolId });

  // Enforce cap (10) and roster size (5) for your Alpha invariant
  const rosterSize = pool.rosterSize ?? 5;
  const salaryCap = pool.salaryCap ?? 10;

  if (playerIds.length !== rosterSize) {
    return res.status(400).json({ ok: false, error: 'INVALID_ROSTER_SIZE', expected: rosterSize, got: playerIds.length });
  }

  const picks = playerIds.map(id => DEMO_PLAYERS.find(p => p.id === id)).filter(Boolean);
  if (picks.length !== rosterSize) {
    return res.status(400).json({ ok: false, error: 'INVALID_PLAYER_IDS' });
  }

  const totalCost = picks.reduce((sum, p) => sum + (p.cost || 0), 0);
  if (totalCost > salaryCap) {
    return res.status(400).json({ ok: false, error: 'OVER_CAP', salaryCap, totalCost });
  }

  // DEMO: no DB write, just return success
  return res.json({
    ok: true,
    mode: 'DEMO',
    username,
    poolId,
    totalCost,
    ts: nowIso(),
    message: 'Joined (DEMO).',
  });
});

// ---------------------------
// Important: Cloud Run MUST listen on process.env.PORT
// ---------------------------
const PORT = Number(process.env.PORT || 8080);

// Bind to 0.0.0.0 is important in containers / Cloud Run
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[shfantasy] listening on 0.0.0.0:${PORT} @ ${nowIso()}`);
});
