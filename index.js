// shfantasy/index.js
'use strict';

const path = require('path');
const express = require('express');

let getFirestore;
try {
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  getFirestore = () => null;
}

const app = express();
app.use(express.json());

// -----------------------------
// Static files
// -----------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1h',
  })
);

// -----------------------------
// Firestore
// -----------------------------
const db = getFirestore();
const MODE = process.env.DATA_MODE || 'DEMO';

// -----------------------------
// Demo pools
// -----------------------------
const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

// -----------------------------
// Health
// -----------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: MODE, ts: new Date().toISOString() });
});

// -----------------------------
// Get Pools
// -----------------------------
app.get('/api/pools', async (req, res) => {
  if (MODE === 'DEMO' || !db) {
    return res.json({
      ok: true,
      mode: MODE,
      ts: new Date().toISOString(),
      pools: DEMO_POOLS,
    });
  }

  // LIVE mode
  return res.json({
    ok: true,
    mode: MODE,
    ts: new Date().toISOString(),
    pools: DEMO_POOLS,
  });
});

// -----------------------------
// JOIN POOL (🔥 NEW)
// -----------------------------
app.post('/api/join', async (req, res) => {
  const { poolId, username } = req.body;

  if (!poolId || !username) {
    return res.status(400).json({ ok: false, error: 'Missing poolId or username' });
  }

  if (!db) {
    return res.status(500).json({ ok: false, error: 'Firestore not initialized' });
  }

  try {
    const entryRef = await db.collection('entries').add({
      poolId,
      username,
      createdAt: new Date(),
      lineup: [],
      status: 'draft',
    });

    return res.json({
      ok: true,
      entryId: entryRef.id,
      mode: MODE,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Join failed' });
  }
});

// -----------------------------
// MY ENTRIES
// -----------------------------
app.get('/api/my-entries', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ ok: false, error: 'Missing username' });
  }

  if (!db) {
    return res.status(500).json({ ok: false, error: 'Firestore not initialized' });
  }

  try {
    const snapshot = await db
      .collection('entries')
      .where('username', '==', username)
      .get();

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      ok: true,
      mode: MODE,
      entries,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Fetch failed' });
  }
});

// -----------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${MODE})`);
});
