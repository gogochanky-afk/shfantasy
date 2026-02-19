// shfantasy/index.js
'use strict';

const path = require('path');
const express = require('express');

// ------------------------------
// Firestore loader (optional)
// ------------------------------
let getFirestore;
try {
  // If you have ./firebase.js exporting { getFirestore }
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
const MODE = (process.env.DATA_MODE || 'DEMO').toUpperCase(); // DEMO | LIVE
const PORT = parseInt(process.env.PORT || '8080', 10);

// Static files
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// Firestore (optional)
const db = getFirestore();

// ------------------------------
// Demo data
// ------------------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

// Minimal demo players (optional; keep if your draft UI expects it)
const DEMO_PLAYERS = [
  { id: 'p1', name: 'Demo Player 1', team: 'AAA', cost: 1 },
  { id: 'p2', name: 'Demo Player 2', team: 'BBB', cost: 2 },
  { id: 'p3', name: 'Demo Player 3', team: 'CCC', cost: 3 },
  { id: 'p4', name: 'Demo Player 4', team: 'DDD', cost: 4 },
  { id: 'p5', name: 'Demo Player 5', team: 'EEE', cost: 2 },
];

// ------------------------------
// Helpers
// ------------------------------
function nowIso() {
  return new Date().toISOString();
}

function requireBodyFields(body, fields) {
  for (const f of fields) {
    if (body?.[f] === undefined || body?.[f] === null || body?.[f] === '') {
      return f;
    }
  }
  return null;
}

function safeUser(u) {
  // keep simple; avoid weird chars in doc ids
  return String(u || '')
    .trim()
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9_\-]/g, '');
}

function makeEntryId(poolId, user) {
  return `${poolId}__${user}__${Date.now()}`;
}

async function listPools() {
  if (MODE !== 'LIVE' || !db) return DEMO_POOLS;

  // LIVE: read from Firestore if you later create pools
  // For now, fallback to DEMO_POOLS (but marked LIVE) so UI works end-to-end.
  // When you implement real pools, replace this with Firestore fetch.
  return DEMO_POOLS;
}

async function getUserEntries(user) {
  if (!user) return [];
  if (MODE !== 'LIVE' || !db) return [];

  // entries collection: one doc per entry
  const snap = await db
    .collection('entries')
    .where('user', '==', user)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const out = [];
  snap.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
  return out;
}

// ------------------------------
// Health / JSON endpoints (keep your existing pattern)
// ------------------------------
app.get('/health.json', (req, res) => {
  res.json({ status: 'ok', mode: MODE, ts: nowIso() });
});

app.get('/pools.json', async (req, res) => {
  const pools = await listPools();
  res.json({ ok: true, mode: MODE, ts: nowIso(), pools });
});

app.get('/my-entries.json', async (req, res) => {
  const user = safeUser(req.query.user || '');
  const entries = await getUserEntries(user);
  res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
});

// ------------------------------
// API endpoints (fix "Cannot GET /api/my-entries" + add LIVE join)
// ------------------------------
app.get('/api/pools', async (req, res) => {
  const pools = await listPools();
  res.json({ ok: true, mode: MODE, ts: nowIso(), pools });
});

app.get('/api/my-entries', async (req, res) => {
  const user = safeUser(req.query.user || '');
  const entries = await getUserEntries(user);
  res.json({ ok: true, mode: MODE, ts: nowIso(), entries });
});

/**
 * POST /api/join
 * body: { user, poolId }
 * Creates an entry (LIVE -> Firestore, DEMO -> in-memory response)
 */
app.post('/api/join', async (req, res) => {
  try {
    const missing = requireBodyFields(req.body, ['user', 'poolId']);
    if (missing) {
      return res.status(400).json({
        ok: false,
        mode: MODE,
        error: `MISSING_${missing.toUpperCase()}`,
      });
    }

    const user = safeUser(req.body.user);
    const poolId = String(req.body.poolId).trim();

    if (!user) {
      return res.status(400).json({ ok: false, mode: MODE, error: 'INVALID_USER' });
    }
    if (!poolId) {
      return res.status(400).json({ ok: false, mode: MODE, error: 'INVALID_POOL' });
    }

    // Validate pool exists (against current list)
    const pools = await listPools();
    const pool = pools.find((p) => p.id === poolId);
    if (!pool) {
      return res.status(404).json({ ok: false, mode: MODE, error: 'POOL_NOT_FOUND' });
    }

    // DEMO: just return an entry id (no persistence)
    if (MODE !== 'LIVE') {
      const entryId = makeEntryId(poolId, user);
      return res.json({
        ok: true,
        mode: MODE,
        ts: nowIso(),
        entryId,
        pool,
        // your UI can redirect to /draft?entryId=...
        draftUrl: `/draft?entryId=${encodeURIComponent(entryId)}`,
      });
    }

    // LIVE: must have Firestore
    if (!db) {
      return res.status(503).json({
        ok: false,
        mode: MODE,
        error: 'FIRESTORE_NOT_CONFIGURED',
      });
    }

    // Create entry
    const entryId = makeEntryId(poolId, user);
    const doc = db.collection('entries').doc(entryId);

    const payload = {
      user,
      poolId,
      poolName: pool.name,
      salaryCap: pool.salaryCap,
      rosterSize: pool.rosterSize,
      // Start empty; Draft page will update this later
      playerIds: [],
      // timestamps
      createdAt: new Date(), // Firestore can store Date
      updatedAt: new Date(),
      // helpful debug
      mode: MODE,
    };

    await doc.set(payload, { merge: false });

    return res.json({
      ok: true,
      mode: MODE,
      ts: nowIso(),
      entryId,
      pool,
      draftUrl: `/draft?entryId=${encodeURIComponent(entryId)}`,
    });
  } catch (err) {
    console.error('JOIN_ERROR', err);
    return res.status(500).json({
      ok: false,
      mode: MODE,
      error: 'JOIN_FAILED',
    });
  }
});

// Optional: update entry players from Draft (if your draft UI already calls something like this)
app.post('/api/save-entry', async (req, res) => {
  try {
    const missing = requireBodyFields(req.body, ['entryId', 'playerIds']);
    if (missing) {
      return res.status(400).json({
        ok: false,
        mode: MODE,
        error: `MISSING_${missing.toUpperCase()}`,
      });
    }

    const entryId = String(req.body.entryId).trim();
    const playerIds = Array.isArray(req.body.playerIds) ? req.body.playerIds : null;

    if (!entryId) return res.status(400).json({ ok: false, mode: MODE, error: 'INVALID_ENTRY' });
    if (!playerIds) return res.status(400).json({ ok: false, mode: MODE, error: 'INVALID_PLAYER_IDS' });

    if (MODE !== 'LIVE') {
      // DEMO: accept but no persistence
      return res.json({ ok: true, mode: MODE, ts: nowIso() });
    }

    if (!db) {
      return res.status(503).json({ ok: false, mode: MODE, error: 'FIRESTORE_NOT_CONFIGURED' });
    }

    await db.collection('entries').doc(entryId).set(
      {
        playerIds,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return res.json({ ok: true, mode: MODE, ts: nowIso() });
  } catch (err) {
    console.error('SAVE_ENTRY_ERROR', err);
    return res.status(500).json({ ok: false, mode: MODE, error: 'SAVE_ENTRY_FAILED' });
  }
});

// ------------------------------
// SPA fallback (optional)
// ------------------------------
app.get('*', (req, res) => {
  // If you have an index.html in /public
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------
// Start
// ------------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] listening on :${PORT} mode=${MODE}`);
});
