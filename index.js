'use strict';

const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check (Cloud Run / Load Balancer friendly)
 */
app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

/**
 * Simple ping
 */
app.get('/ping', (req, res) => {
  res.status(200).json({ ok: true, message: 'pong' });
});

/**
 * API ping (kept for compatibility with your earlier test)
 */
app.get('/api/ping', (req, res) => {
  res.status(200).json({ ok: true, message: 'pong' });
});

/**
 * Demo pools API (for fallback so UI won't infinite load)
 */
const demoPools = [
  { id: 'demo-1', name: 'Demo Pool', prize: 100, entry: 5 },
];

app.get('/api/pools', (req, res) => {
  res.status(200).json({ ok: true, pools: demoPools });
});

/**
 * IMPORTANT: alias route for frontend that might call /pools
 * This fixes your "pools.json Not found" screenshot.
 */
app.get('/pools', (req, res) => {
  res.redirect(302, '/api/pools');
});

/**
 * Serve built frontend if exists: frontend/dist
 */
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

/**
 * SPA fallback: return index.html for non-API routes
 * But keep /api/* as 404 JSON if not found.
 */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }

  return res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // If frontend not built / dist missing, still return something
      return res.status(200).send('SHFantasy API is running. Try /api/ping or /api/pools');
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
