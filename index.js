// shfantasy/index.js
'use strict';

const path = require('path');
const express = require('express');

let getFirestore;
try {
  // If you have ./firebase.js in your repo, it should export { getFirestore }
  // Example: module.exports = { getFirestore: () => admin.firestore() }
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  // Fallback: run even if firebase is not configured
  getFirestore = () => null;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

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
// Config
// ------------------------------
const MODE = (process.env.DATA_MODE || 'DEMO').toUpperCase(); // DEMO / LIVE
const PORT = Number(process.env.PORT || 8080);

// ------------------------------
// Demo data (fallback-safe)
// ------------------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

// Minimal demo player set (keep stable). You can replace later.
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

// ------------------------------
// Firestore (optional)
// ------------------------------
const db = getFirestore ? getFirestore() : null;

// In-memory fallback (only used if Firestore not available)
const mem = {
  entriesByUser: new Map(), // username -> [entry]
};

function nowISO() {
  return new Date().toISOString();
}

function safeString(x, max = 60) {
  if (typeof x !== 'string') return '';
  return x.trim().slice(0, max);
}

function makeEntryId() {
  return `e_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function validateRoster(playerIds, salaryCap, rosterSize) {
  if (!Array.isArray(playerIds)) return { ok: false, reason: 'MISSING_PLAYER_IDS' };
  if (playerIds.length !== rosterSize) return { ok: false, reason: 'INVALID_ROSTER_SIZE' };

  const unique = new Set(playerIds);
  if (unique.size !== playerIds.length) return { ok: false, reason: 'DUPLICATE_PLAYERS' };

  // Cost check against DEMO_PLAYERS for now (later replace with LIVE roster/pricing table)
  const costMap = new Map(DEMO_PLAYERS.map(p => [p.id, p.cost]));
  let total = 0;
  for (const pid of playerIds) {
    if (!costMap.has(pid)) return { ok: false, reason: 'UNKNOWN_PLAYER_ID' };
    total += costMap.get(pid);
  }
  if (total > salaryCap) return { ok: false, reason: 'OVER_SALARY_CAP' };

  return { ok: true, totalCost: total };
}

// ------------------------------
// Health
// ------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: MODE, ts: nowISO() });
});

// ------------------------------
// API: Pools
// - LIVE: try Firestore pools; fallback to DEMO_POOLS if none / db missing
// ------------------------------
app.get('/api/pools', async (req, res) => {
  try {
    if (MODE === 'LIVE' && db) {
      // Try Firestore: collection "pools"
      // Expected pool doc fields: name, salaryCap, rosterSize, isActive (optional)
      const snap = await db.collection('pools').limit(20).get();
      const pools = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        pools.push({
          id: doc.id,
          name: d.name || doc.id,
          salaryCap: Number(d.salaryCap ?? 10),
          rosterSize: Number(d.rosterSize ?? 5),
        });
      });

      if (pools.length > 0) {
        return res.json({ ok: true, mode: MODE, ts: nowISO(), pools });
      }

      // If LIVE but no pools yet -> fallback
      return res.json({
        ok: true,
        mode: MODE,
        fallback: true,
        ts: nowISO(),
        pools: DEMO_POOLS,
      });
    }

    // DEMO / no DB
    return res.json({ ok: true, mode: MODE, ts: nowISO(), pools: DEMO_POOLS });
  } catch (e) {
    return res.json({
      ok: true,
      mode: MODE,
      fallback: true,
      ts: nowISO(),
      pools: DEMO_POOLS,
      note: 'pools_firestore_error_fallback',
    });
  }
});

// ------------------------------
// API: Players (for Draft UI)
// - LIVE: (for now) return DEMO_PLAYERS as safe fallback until real roster wired
// ------------------------------
app.get('/api/players', async (req, res) => {
  return res.json({ ok: true, mode: MODE, ts: nowISO(), players: DEMO_PLAYERS });
});

// ------------------------------
// API: Join
// POST /api/join
// body: { username, poolId }
// Creates an entry (empty lineup) and saves it.
// ------------------------------
app.post('/api/join', async (req, res) => {
  try {
    const username = safeString(req.body?.username, 40);
    const poolId = safeString(req.body?.poolId, 80);

    if (!username) return res.status(400).json({ ok: false, reason: 'MISSING_USERNAME' });
    if (!poolId) return res.status(400).json({ ok: false, reason: 'MISSING_POOL_ID' });

    // Resolve pool config (LIVE pools if available, else DEMO)
    let pool = DEMO_POOLS.find(p => p.id === poolId) || null;

    if (MODE === 'LIVE' && db) {
      // If poolId exists in Firestore, prefer it
      try {
        const doc = await db.collection('pools').doc(poolId).get();
        if (doc.exists) {
          const d = doc.data() || {};
          pool = {
            id: doc.id,
            name: d.name || doc.id,
            salaryCap: Number(d.salaryCap ?? 10),
            rosterSize: Number(d.rosterSize ?? 5),
          };
        }
      } catch (_) {
        // ignore, keep fallback
      }
    }

    if (!pool) {
      // Still unknown -> allow join but mark fallback pool config
      pool = { id: poolId, name: poolId, salaryCap: 10, rosterSize: 5 };
    }

    const entry = {
      id: makeEntryId(),
      username,
      poolId: pool.id,
      poolName: pool.name,
      salaryCap: pool.salaryCap,
      rosterSize: pool.rosterSize,
      playerIds: [], // empty until user submits lineup
      totalCost: 0,
      status: 'DRAFT',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      mode: MODE,
    };

    // Save to Firestore if available, else in-memory
    if (db) {
      await db.collection('entries').doc(entry.id).set(entry, { merge: true });
    } else {
      const list = mem.entriesByUser.get(username) || [];
      list.unshift(entry);
      mem.entriesByUser.set(username, list.slice(0, 50));
    }

    return res.json({ ok: true, mode: MODE, ts: nowISO(), entry });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: 'JOIN_FAILED', ts: nowISO() });
  }
});

// ------------------------------
// API: Save lineup
// POST /api/save-lineup
// body: { entryId, username, playerIds }
// Validates cap + roster size, then saves.
// ------------------------------
app.post('/api/save-lineup', async (req, res) => {
  try {
    const entryId = safeString(req.body?.entryId, 120);
    const username = safeString(req.body?.username, 40);
    const playerIds = req.body?.playerIds;

    if (!entryId) return res.status(400).json({ ok: false, reason: 'MISSING_ENTRY_ID' });
    if (!username) return res.status(400).json({ ok: false, reason: 'MISSING_USERNAME' });

    // Load entry
    let entry = null;

    if (db) {
      const doc = await db.collection('entries').doc(entryId).get();
      if (!doc.exists) return res.status(404).json({ ok: false, reason: 'ENTRY_NOT_FOUND' });
      entry = doc.data();
    } else {
      const list = mem.entriesByUser.get(username) || [];
      entry = list.find(e => e.id === entryId) || null;
      if (!entry) return res.status(404).json({ ok: false, reason: 'ENTRY_NOT_FOUND' });
    }

    if (entry.username !== username) {
      return res.status(403).json({ ok: false, reason: 'USERNAME_MISMATCH' });
    }

    const salaryCap = Number(entry.salaryCap ?? 10);
    const rosterSize = Number(entry.rosterSize ?? 5);

    const v = validateRoster(playerIds, salaryCap, rosterSize);
    if (!v.ok) return res.status(400).json({ ok: false, reason: v.reason });

    const patch = {
      playerIds,
      totalCost: v.totalCost,
      status: 'SUBMITTED',
      updatedAt: nowISO(),
    };

    if (db) {
      await db.collection('entries').doc(entryId).set(patch, { merge: true });
    } else {
      const list = mem.entriesByUser.get(username) || [];
      const idx = list.findIndex(e => e.id === entryId);
      if (idx >= 0) list[idx] = { ...list[idx], ...patch };
      mem.entriesByUser.set(username, list);
    }

    return res.json({ ok: true, mode: MODE, ts: nowISO(), entryId, ...patch });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: 'SAVE_LINEUP_FAILED', ts: nowISO() });
  }
});

// ------------------------------
// API: My Entries
// GET /api/my-entries?username=Hugo
// ------------------------------
app.get('/api/my-entries', async (req, res) => {
  try {
    const username = safeString(req.query?.username, 40);
    if (!username) return res.status(400).json({ ok: false, reason: 'MISSING_USERNAME' });

    if (db) {
      const snap = await db
        .collection('entries')
        .where('username', '==', username)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const entries = [];
      snap.forEach(doc => entries.push(doc.data()));
      return res.json({ ok: true, mode: MODE, ts: nowISO(), entries });
    }

    const entries = mem.entriesByUser.get(username) || [];
    return res.json({ ok: true, mode: MODE, ts: nowISO(), entries });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: 'MY_ENTRIES_FAILED', ts: nowISO() });
  }
});

// ------------------------------
// API: Debug (optional)
// ------------------------------
app.get('/api/debug', (req, res) => {
  res.json({
    ok: true,
    mode: MODE,
    ts: nowISO(),
    hasFirestore: Boolean(db),
    port: PORT,
  });
});

// ------------------------------
// API 404 (keep before SPA fallback)
// ------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, reason: 'API_NOT_FOUND' });
});

// ------------------------------
// SPA fallback: serve index.html
// ------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------
// Start server
// ------------------------------
app.listen(PORT, () => {
  console.log(`[shfantasy] server started on port ${PORT} | MODE=${MODE}`);
});
