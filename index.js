'use strict';

const path = require('path');
const express = require('express');

const app = express();

/**
 * ===== Basic middleware =====
 */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * ===== Health check =====
 */
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

/**
 * ===== API test =====
 */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong' });
});

/**
 * ===== Serve frontend build =====
 */
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');

app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }

  return res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('SH Fantasy backend running (no frontend build found)');
    }
  });
});

/**
 * ===== START SERVER (CRITICAL FOR CLOUD RUN) =====
 */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
