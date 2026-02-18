const express = require('express');
const app = express();

app.use(express.json());

/**
 * DEMO POOLS
 */
const demoPools = [
  {
    id: 1,
    date: "2026-02-18",
    homeTeam: "Lakers",
    awayTeam: "Warriors",
    entryFee: 10,
    prizePool: 100,
    status: "open"
  },
  {
    id: 2,
    date: "2026-02-18",
    homeTeam: "Celtics",
    awayTeam: "Bucks",
    entryFee: 10,
    prizePool: 120,
    status: "open"
  }
];

/**
 * Root
 */
app.get('/', (req, res) => {
  res.send('SH Fantasy Backend Running 🚀');
});

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * GET Pools
 */
app.get('/api/pools', (req, res) => {
  res.json({ pools: demoPools });
});

/**
 * Join Pool
 */
app.post('/api/join', (req, res) => {
  const { poolId, username } = req.body;

  if (!poolId || !username) {
    return res.status(400).json({ error: "Missing poolId or username" });
  }

  res.json({
    success: true,
    message: `${username} joined pool ${poolId}`
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
