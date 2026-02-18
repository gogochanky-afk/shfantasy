const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());

/* =========================
   API ROUTES
========================= */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/pools', (req, res) => {
  res.json({
    mode: 'DEMO',
    pools: [
      {
        id: 'demo-today',
        name: 'Today Arena',
        salaryCap: 10,
        rosterSize: 5,
        date: 'today'
      },
      {
        id: 'demo-tomorrow',
        name: 'Tomorrow Arena',
        salaryCap: 10,
        rosterSize: 5,
        date: 'tomorrow'
      }
    ]
  });
});

app.post('/api/join', (req, res) => {
  const { username, poolId } = req.body;
  res.json({
    success: true,
    message: `${username} joined ${poolId}`
  });
});

/* =========================
   SERVE FRONTEND
========================= */

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
