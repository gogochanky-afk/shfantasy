// shfantasy/index.js
'use strict';

const path = require('path');
const express = require('express');

let getFirestore;
try {
  // If you have ./firebase.js in your repo (as discussed)
  ({ getFirestore } = require('./firebase'));
} catch (e) {
  // Fallback: run even if firebase is not configured
  getFirestore = () => null;
}

const app = express();
app.use(express.json());

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
// Firestore (optional)
// ------------------------------
const db = getFirestore();

// ------------------------------
// Demo data
// ------------------------------
const MODE = process.env.DATA_MODE || 'DEMO';

const DEMO_POOLS = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 },
];

// Mixed costs 1–4 (sample)
const DEMO_PLAYERS = [
  // cost 4 (stars)
  { id: 'p1', name: 'Nikola Jokic', cost: 4, team: 'DEN', pos: 'C' },
  { id: 'p2', name: 'Luka Doncic', cost: 4, team: 'DAL', pos: 'G' },
  { id: 'p3', name: 'Giannis Antetokounmpo', cost: 4, team: 'MIL', pos: 'F' },
  { id: 'p4', name: 'Shai Gilgeous-Alexander', cost: 4, team: 'OKC', pos: 'G' },
  { id: 'p5', name: 'Joel Embiid', cost: 4, team: 'PHI', pos: 'C' },

  // cost 3
  { id: 'p6', name: 'Stephen Curry', cost: 3, team: 'GSW', pos: 'G' },
  { id: 'p7', name: 'Kevin Durant', cost: 3, team: 'PHX', pos: 'F' },
  { id: 'p8', name: 'Jayson Tatum', cost: 3, team: 'BOS', pos: 'F' },
  { id: 'p9', name: 'LeBron James', cost: 3, team: 'LAL', pos: 'F' },
  { id: 'p10', name: 'Anthony Davis', cost: 3, team: 'LAL', pos: 'F/C' },

  // cost 2
  { id: 'p11', name: 'Kyrie Irving', cost: 2, team: 'DAL', pos: 'G' },
  { id: 'p12', name: 'Jaylen Brown', cost: 2, team: 'BOS', pos: 'G/F' },
  { id: 'p13', name: 'Devin Booker', cost: 2, team: 'PHX', pos: 'G' },
  { id: 'p14', name: 'Bam Adebayo', cost: 2, team: 'MIA', pos: 'C' },
  { id: 'p15', name: 'Pascal Siakam', cost: 2, team: 'IND', pos: 'F' },

  // cost 1 (value)
  { id: 'p16', name: 'Josh Hart', cost: 1, team: 'NYK', pos: 'G/F' },
  { id: 'p17', name: 'Derrick White', cost: 1, team: 'BOS', pos: 'G' },
  { id: 'p18', name: 'Brook Lopez', cost: 1, team: 'MIL', pos: 'C' },
  { id: 'p19', name: 'Keldon Johnson', cost: 1, team: 'SAS', pos: 'F' },
  { id: 'p20', name: 'Alex Caruso', cost: 1, team: 'OKC', pos: 'G' },
];

// Helper
function nowISO() {
  return new Date().toISOString();
}

function requireUsername(req) {
  const username = (req.query.username || '').trim();
  if (!username) return null;
  return username;
}

// ------------------------------
// Health + simple JSON endpoints
// ------------------------------
app.get('/health.json', (req, res) => {
  res.json({ status: 'ok', ts: nowISO() });
});

app.get('/pools.json', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowISO(), pools: DEMO_POOLS });
});

// ------------------------------
// API endpoints
// ------------------------------
app.get('/api/pools', (req, res) => {
  res.json({ ok: true, mode: MODE, ts: nowISO(), pools: DEMO_POOLS });
});

app.get('/api/players', (req, res) => {
  // If later you want real data mode, switch by MODE here
  res.json({ ok: true, mode: MODE, ts: nowISO(), players: DEMO_PLAYERS });
});

/**
 * ✅ FIX: /api/my-entries
 * Used by public/my-entries.html
 * Query: /api/my-entries?username=Hugo
 */
app.get('/api/my-entries', async (req, res) => {
  try {
    const username = requireUsername(req);
    if (!username) {
      return res.status(400).json({ ok: false, error: 'Missing username' });
    }

    // If firestore not configured, still return empty list (DEMO fallback)
    if (!db) {
      return res.json({ ok: true, mode: MODE, ts: nowISO(), entries: [] });
    }

    // Collection name kept simple: "entries"
    const snap = await db.collection('entries').where('username', '==', username).get();
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({ ok: true, mode: MODE, ts: nowISO(), entries });
  } catch (err) {
    console.error('[api/my-entries] error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ------------------------------
// Default route -> index.html
// ------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------
// Start server (Cloud Run expects PORT)
// ------------------------------
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, () => {
  console.log(`SH Fantasy server listening on ${PORT} (mode=${MODE})`);
});
