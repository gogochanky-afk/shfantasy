'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const MODE = process.env.DATA_MODE || process.env.MODE || 'LIVE';
const PORT = process.env.PORT || 8080;

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function nowIso() {
  return new Date().toISOString();
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
  const cleaned = s.replace(/[^\w.\- ]/g, '').trim();
  return cleaned.slice(0, 24);
}

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

const POOLS_BY_ID = Object.fromEntries(DEMO_POOLS.map(p => [p.id, p]));
const PLAYERS_BY_ID = Object.fromEntries(DEMO_PLAYERS.map(p => [p.id, p]));

const STORE_PATH = '/tmp/shfantasy_store.json';

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
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

function makeEntryId() {
  return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getEntry(id) {
  return store.entries[id] || null;
}

function upsertEntry(entry) {
  store.entries[entry.id] = entry;
  saveStore(store);
}

app.get('/health', (req, res) => {
  return jsonOk(res, { status: 'ok', mode: MODE, ts: nowIso() });
});

app.get('/api/pools', (req, res) => {
  return jsonOk(res, { ok: true, pools: DEMO_POOLS, mode: MODE, ts: nowIso() });
});

app.get('/api/players', (req, res) => {
  return jsonOk(res, { ok: true, players: DEMO_PLAYERS, mode: MODE, ts: nowIso() });
});

app.post('/api/join', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const poolId = String(req.body?.poolId || '').trim();

  if (!username) return jsonErr(res, 'INVALID_USERNAME', 'Username required');
  if (!POOLS_BY_ID[poolId]) return jsonErr(res, 'POOL_NOT_FOUND', 'Pool not found');

  const entry = {
    id: makeEntryId(),
    username,
    poolId,
    players: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  upsertEntry(entry);

  return jsonOk(res, {
    ok: true,
    entryId: entry.id,
    redirect: `/draft.html?entryId=${entry.id}`,
  });
});

app.get('/api/lineup', (req, res) => {
  const entry = getEntry(req.query.entryId);
  if (!entry) return jsonErr(res, 'NOT_FOUND', 'Entry not found', 404);

  return jsonOk(res, { ok: true, entry, pool: POOLS_BY_ID[entry.poolId] });
});

app.post('/api/lineup', (req, res) => {
  const entry = getEntry(req.body?.entryId);
  if (!entry) return jsonErr(res, 'NOT_FOUND', 'Entry not found', 404);

  const pool = POOLS_BY_ID[entry.poolId];
  const players = Array.from(new Set((req.body.players || []).map(String)));

  if (players.length !== pool.rosterSize)
    return jsonErr(res, 'ROSTER_INVALID', 'Wrong roster size');

  let cost = 0;
  for (const id of players) {
    const p = PLAYERS_BY_ID[id];
    if (!p) return jsonErr(res, 'PLAYER_NOT_FOUND', id);
    cost += p.cost;
  }

  if (cost > pool.salaryCap)
    return jsonErr(res, 'CAP_EXCEEDED', 'Salary cap exceeded');

  entry.players = players;
  entry.updatedAt = nowIso();
  upsertEntry(entry);

  return jsonOk(res, { ok: true });
});

app.get('/api/my-entries', (req, res) => {
  const username = normalizeUsername(req.query.username);
  const entries = Object.values(store.entries)
    .filter(e => e.username === username)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return jsonOk(res, { ok: true, entries });
});

app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[shfantasy] listening on ${PORT} mode=${MODE}`);
});
