'use strict';

const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const MODE = process.env.DATA_MODE || 'LIVE';

// ==============================
// In-memory storage (safe LIVE)
// ==============================

const pools = [
  { id: 'demo-today', name: 'Today Arena', salaryCap: 10, rosterSize: 5 },
  { id: 'demo-tomorrow', name: 'Tomorrow Arena', salaryCap: 10, rosterSize: 5 }
];

const players = [
  { id: "p1", name: "LeBron James", team: "LAL", cost: 4 },
  { id: "p2", name: "Stephen Curry", team: "GSW", cost: 4 },
  { id: "p3", name: "Kevin Durant", team: "PHX", cost: 4 },
  { id: "p4", name: "Jayson Tatum", team: "BOS", cost: 4 },
  { id: "p5", name: "Jalen Brunson", team: "NYK", cost: 3 },
  { id: "p6", name: "Anthony Edwards", team: "MIN", cost: 3 },
  { id: "p7", name: "Devin Booker", team: "PHX", cost: 3 },
  { id: "p8", name: "Donovan Mitchell", team: "CLE", cost: 3 },
  { id: "p9", name: "Mikal Bridges", team: "NYK", cost: 2 },
  { id: "p10", name: "Derrick White", team: "BOS", cost: 2 },
  { id: "p11", name: "Austin Reaves", team: "LAL", cost: 2 },
  { id: "p12", name: "Klay Thompson", team: "DAL", cost: 2 },
  { id: "p13", name: "Alex Caruso", team: "OKC", cost: 1 },
  { id: "p14", name: "Josh Hart", team: "NYK", cost: 1 },
  { id: "p15", name: "Naz Reid", team: "MIN", cost: 1 },
  { id: "p16", name: "Dorian Finney-Smith", team: "LAL", cost: 1 }
];

let entries = [];

// ==============================
// Static
// ==============================

app.use(express.static(path.join(__dirname, 'public')));

// ==============================
// Health
// ==============================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: MODE,
    firestore: false,
    ts: new Date().toISOString()
  });
});

// ==============================
// Pools
// ==============================

app.get('/api/pools', (req, res) => {
  res.json({ ok: true, mode: MODE, pools });
});

// ==============================
// Players
// ==============================

app.get('/api/players', (req, res) => {
  res.json({ ok: true, mode: MODE, players });
});

// ==============================
// Join (LIVE memory)
// ==============================

app.post('/api/join', (req, res) => {
  const { username, poolId, lineup } = req.body;

  if (!username || !poolId || !Array.isArray(lineup)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const pool = pools.find(p => p.id === poolId);
  if (!pool) {
    return res.status(400).json({ ok: false, error: 'Pool not found' });
  }

  if (lineup.length !== pool.rosterSize) {
    return res.status(400).json({ ok: false, error: 'Invalid roster size' });
  }

  let totalCost = 0;

  for (let pid of lineup) {
    const player = players.find(p => p.id === pid);
    if (!player) {
      return res.status(400).json({ ok: false, error: 'Invalid player' });
    }
    totalCost += player.cost;
  }

  if (totalCost > pool.salaryCap) {
    return res.status(400).json({ ok: false, error: 'Salary cap exceeded' });
  }

  const entry = {
    id: 'e_' + Date.now(),
    username,
    poolId,
    lineup,
    createdAt: new Date().toISOString()
  };

  entries.push(entry);

  res.json({ ok: true, entry });
});

// ==============================
// My Entries
// ==============================

app.get('/api/my-entries', (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ ok: false, error: 'Missing username' });
  }

  const userEntries = entries.filter(e => e.username === username);

  res.json({ ok: true, mode: MODE, entries: userEntries });
});

// ==============================
// Start Server
// ==============================

app.listen(PORT, () => {
  console.log(`SH Fantasy running on port ${PORT}`);
});
