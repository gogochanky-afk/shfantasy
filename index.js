// /index.js
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const { Storage } = require('@google-cloud/storage');

const app = express();

// -------------------- config --------------------
const MODE = process.env.DATA_MODE || process.env.MODE || 'LIVE';
const PORT = process.env.PORT || 8080;

// GCS (real persistence)
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const storage = new Storage();
const bucket = BUCKET_NAME ? storage.bucket(BUCKET_NAME) : null;

// Cloud Run behind proxy
app.set('trust proxy', 1);

// Body
app.use(express.json({ limit: '1mb' }));

// Static
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
  // allow letters, numbers, space, underscore, dash, dot
  const cleaned = s.replace(/[^\w.\- ]/g, '').trim();
  // max 24
  return cleaned.slice(0, 24);
}

function yyyymmddUTC(d = new Date()) {
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function isoMinusMinutes(iso, minutes) {
  const t = new Date(iso).getTime();
  return new Date(t - minutes * 60 * 1000).toISOString();
}

// -------------------- demo data (stable schema) --------------------
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

function toIndexById(arr) {
  return Object.fromEntries(arr.map(x => [x.id, x]));
}

// -------------------- GCS JSON helpers --------------------
async function gcsReadJson(key) {
  if (!bucket) return null;
  const file = bucket.file(key);
  try {
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    const txt = buf.toString('utf-8');
    const obj = JSON.parse(txt);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (_) {
    return null;
  }
}

async function gcsWriteJson(key, obj) {
  if (!bucket) throw new Error('BUCKET_NOT_SET');
  const file = bucket.file(key);
  const content = JSON.stringify(obj, null, 2);
  await file.save(content, { contentType: 'application/json', resumable: false });
}

// paths in bucket
const LIVE_POOLS_KEY = 'live/pools.json';
const LIVE_PLAYERS_KEY = 'live/players.json';

// -------------------- simple persistence (instance-level) --------------------
// Cloud Run is ephemeral, but /tmp is writable; still keep it for entries MVP.
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

function getAdminToken(req) {
  const h = String(req.headers['x-admin-token'] || '').trim();
  const q = String(req.query.adminToken || '').trim();
  return h || q;
}

async function getPoolsAndMode() {
  // live-first: read from GCS; fallback to demo
  const live = await gcsReadJson(LIVE_POOLS_KEY);
  if (live && Array.isArray(live.pools)) {
    return { pools: live.pools, dataMode: 'LIVE_GCS', meta: live.meta || null };
  }
  return { pools: DEMO_POOLS, dataMode: 'DEMO_FALLBACK', meta: null };
}

async function getPlayersAndMode() {
  const live = await gcsReadJson(LIVE_PLAYERS_KEY);
  if (live && Array.isArray(live.players)) {
    return { players: live.players, dataMode: 'LIVE_GCS', meta: live.meta || null };
  }
  return { players: DEMO_PLAYERS, dataMode: 'DEMO_FALLBACK', meta: null };
}

// -------------------- routes --------------------
app.get('/health', async (req, res) => {
  const okBucket = !!BUCKET_NAME;
  return jsonOk(res, {
    status: 'ok',
    mode: MODE,
    bucket: okBucket ? BUCKET_NAME : null,
    ts: nowIso(),
  });
});

// pools (live from GCS if available)
app.get('/api/pools', async (req, res) => {
  const { pools, dataMode, meta } = await getPoolsAndMode();
  return jsonOk(res, {
    ok: true,
    mode: MODE,
    dataMode,
    ts: nowIso(),
    meta,
    pools,
  });
});

// players (live from GCS if available)
app.get('/api/players', async (req, res) => {
  const { players, dataMode, meta } = await getPlayersAndMode();
  return jsonOk(res, {
    ok: true,
    mode: MODE,
    dataMode,
    ts: nowIso(),
    meta,
    players,
  });
});

// --- admin: refresh pools from ESPN scoreboard (no API key) ---
app.post('/admin/refresh-pools', async (req, res) => {
  if (!ADMIN_TOKEN) return jsonErr(res, 'ADMIN_TOKEN_NOT_SET', 'ADMIN_TOKEN not set on server.', 500);
  const token = getAdminToken(req);
  if (!token || token !== ADMIN_TOKEN) return jsonErr(res, 'UNAUTHORIZED', 'Invalid admin token.', 401);

  if (!bucket) return jsonErr(res, 'BUCKET_NOT_SET', 'BUCKET_NAME not set.', 500);

  // fetch today + tomorrow scoreboard (UTC)
  const today = yyyymmddUTC(new Date());
  const tomorrow = yyyymmddUTC(new Date(Date.now() + 24 * 3600 * 1000));

  async function fetchScoreboard(dateStr) {
    const url = `https://site.web.api.espn.com/apis/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'shfantasy/1.0' } });
    if (!r.ok) throw new Error(`ESPN_FETCH_FAILED_${dateStr}_${r.status}`);
    return await r.json();
  }

  function mapEventsToPools(scoreboardJson) {
    const events = scoreboardJson && Array.isArray(scoreboardJson.events) ? scoreboardJson.events : [];
    const pools = [];
    for (const ev of events) {
      const id = String(ev && ev.id ? ev.id : '').trim();
      const iso = String(ev && ev.date ? ev.date : '').trim();

      const comps = ev && Array.isArray(ev.competitions) ? ev.competitions : [];
      const c0 = comps[0] || {};
      const competitors = c0 && Array.isArray(c0.competitors) ? c0.competitors : [];

      const home = competitors.find(x => x.homeAway === 'home') || {};
      const away = competitors.find(x => x.homeAway === 'away') || {};

      const homeAbbr = (home.team && (home.team.abbreviation || home.team.shortDisplayName || home.team.displayName)) || 'HOME';
      const awayAbbr = (away.team && (away.team.abbreviation || away.team.shortDisplayName || away.team.displayName)) || 'AWAY';

      if (!id || !iso) continue;

      pools.push({
        id: `nba-${id}`,
        name: `${awayAbbr} @ ${homeAbbr}`,
        salaryCap: 10,
        rosterSize: 5,
        // lock 15 mins before tip (can change later)
        lockAt: isoMinusMinutes(iso, 15),
        locked: false,
        source: 'ESPN_SCOREBOARD',
        eventId: id,
        eventIso: iso,
        home: String(homeAbbr),
        away: String(awayAbbr),
      });
    }
    return pools;
  }

  try {
    const [s1, s2] = await Promise.all([fetchScoreboard(today), fetchScoreboard(tomorrow)]);
    const pools = [...mapEventsToPools(s1), ...mapEventsToPools(s2)];

    // keep only first N if you want “4 games”
    const max = Number((req.body && req.body.maxPools) || 0) || 0;
    const finalPools = max > 0 ? pools.slice(0, max) : pools;

    const payload = {
      meta: {
        source: 'ESPN_SCOREBOARD',
        generatedAt: nowIso(),
        dates: [today, tomorrow],
        count: finalPools.length,
      },
      pools: finalPools,
    };

    await gcsWriteJson(LIVE_POOLS_KEY, payload);

    return jsonOk(res, {
      ok: true,
      mode: MODE,
      ts: nowIso(),
      wrote: `gs://${BUCKET_NAME}/${LIVE_POOLS_KEY}`,
      count: finalPools.length,
      sample: finalPools.slice(0, 3),
    });
  } catch (e) {
    return jsonErr(res, 'REFRESH_FAILED', e.message || 'refresh failed', 500);
  }
});

// If someone opens in browser (GET), guide them properly
app.get('/api/join', (req, res) => {
  return res.status(405).json({
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Use POST /api/join with JSON body: { "username": "...", "poolId": "..." }',
    mode: MODE,
    ts: nowIso(),
  });
});

// JOIN (stable response)
app.post('/api/join', async (req, res) => {
  const username = normalizeUsername(req.body && req.body.username);
  const poolId = String((req.body && req.body.poolId) || '').trim();

  if (!username) return jsonErr(res, 'INVALID_USERNAME', 'Username is required.');
  if (!poolId) return jsonErr(res, 'INVALID_POOL', 'poolId is required.');

  const { pools } = await getPoolsAndMode();
  const POOLS_BY_ID = Object.fromEntries((pools || []).map(p => [p.id, p]));
  const pool = POOLS_BY_ID[poolId];
  if (!pool) return jsonErr(res, 'POOL_NOT_FOUND', 'Pool not found.');

  // Create entry
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
    ts: nowIso(),
    entryId: id,
    poolId,
    username,
    redirect: `/draft.html?entryId=${encodeURIComponent(id)}`,
  });
});

// GET lineup
app.get('/api/lineup', async (req, res) => {
  const entryId = String(req.query.entryId || '').trim();
  if (!entryId) return jsonErr(res, 'MISSING_ENTRY_ID', 'entryId is required.');
  const entry = getEntry(entryId);
  if (!entry) return jsonErr(res, 'ENTRY_NOT_FOUND', 'Entry not found.', 404);

  const { pools } = await getPoolsAndMode();
  const pool = (pools || []).find(p => p.id === entry.poolId) || null;

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entry,
    pool,
  });
});

// POST lineup (save selected players)
app.post('/api/lineup', async (req, res) => {
  const entryId = String((req.body && req.body.entryId) || '').trim();
  const playersReq = (req.body && req.body.players) || [];

  if (!entryId) return jsonErr(res, 'MISSING_ENTRY_ID', 'entryId is required.');
  const entry = getEntry(entryId);
  if (!entry) return jsonErr(res, 'ENTRY_NOT_FOUND', 'Entry not found.', 404);

  const { pools } = await getPoolsAndMode();
  const pool = (pools || []).find(p => p.id === entry.poolId) || null;
  if (!pool) return jsonErr(res, 'POOL_NOT_FOUND', 'Pool not found.');

  if (!Array.isArray(playersReq)) return jsonErr(res, 'INVALID_PLAYERS', 'players must be an array.');
  const uniq = Array.from(new Set(playersReq.map(x => String(x).trim()).filter(Boolean)));

  const rosterSize = Number(pool.rosterSize) || 5;
  const salaryCap = Number(pool.salaryCap) || 10;

  if (uniq.length !== rosterSize) {
    return jsonErr(res, 'ROSTER_SIZE_INVALID', `Must pick exactly ${rosterSize} players.`, 400, {
      rosterSize,
      picked: uniq.length,
    });
  }

  const { players } = await getPlayersAndMode();
  const PLAYERS_BY_ID = toIndexById(players || []);

  // Validate ids + salary cap
  let cost = 0;
  for (const pid of uniq) {
    const p = PLAYERS_BY_ID[pid];
    if (!p) return jsonErr(res, 'PLAYER_NOT_FOUND', `Player not found: ${pid}`);
    cost += Number(p.cost) || 0;
  }
  if (cost > salaryCap) {
    return jsonErr(res, 'SALARY_CAP_EXCEEDED', `Salary cap exceeded (${cost}/${salaryCap}).`, 400, {
      cost,
      salaryCap,
    });
  }

  entry.players = uniq;
  entry.updatedAt = nowIso();
  upsertEntry(entry);

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    entryId,
    savedPlayers: uniq,
  });
});

// My entries for a username
app.get('/api/my-entries', async (req, res) => {
  const username = normalizeUsername(req.query.username);
  if (!username) return jsonErr(res, 'INVALID_USERNAME', 'username is required.');

  const all = Object.values(store.entries || {});
  const entries = all
    .filter(e => (e.username || '').toLowerCase() === username.toLowerCase())
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const { pools } = await getPoolsAndMode();

  return jsonOk(res, {
    ok: true,
    mode: MODE,
    ts: nowIso(),
    username,
    entries,
    pools,
  });
});

// Root
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[shfantasy] listening on ${PORT} mode=${MODE} bucket=${BUCKET_NAME || '—'}`);
});
