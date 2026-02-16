'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Basic middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Health check (Cloud Run / LB may call)
 */
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

/**
 * Simple ping
 */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong' });
});

/**
 * Pools endpoint (IMPORTANT)
 * - First try DB: ./shfantasy.db (if exists)
 * - If DB missing/error: return DEMO pools (never fail)
 */
app.get('/api/pools', async (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'shfantasy.db');

    // If DB not present, fallback immediately
    if (!fs.existsSync(dbPath)) {
      return res.json({
        ok: true,
        mode: 'DEMO',
        pools: demoPools(),
        note: 'DB not found, serving demo pools'
      });
    }

    // Try sqlite read (optional dependency)
    // If sqlite3 is not installed, it will throw and we fallback to demo
    // eslint-disable-next-line global-require
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);

    // NOTE: Table/columns may differ; we try a safe query and fallback if it fails
    const sql = `
      SELECT
        id, title, lock_ts, status
      FROM pools
      ORDER BY lock_ts ASC
      LIMIT 50
    `;

    db.all(sql, [], (err, rows) => {
      db.close();

      if (err) {
        return res.json({
          ok: true,
          mode: 'DEMO',
          pools: demoPools(),
          note: 'DB query failed, serving demo pools',
          error: String(err)
        });
      }

      // Normalize
      const pools = (rows || []).map(r => ({
        id: r.id,
        title: r.title || 'Pool',
        lock_ts: r.lock_ts || null,
        status: r.status || 'open'
      }));

      return res.json({
        ok: true,
        mode: 'DB',
        pools
      });
    });
  } catch (e) {
    return res.json({
      ok: true,
      mode: 'DEMO',
      pools: demoPools(),
      note: 'Exception, serving demo pools',
      error: String(e)
    });
  }
});

/**
 * Serve Frontend build if exists
 */
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  // SPA fallback: any non-/api route goes to index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ ok: false, error: 'Not Found' });
    }
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // If no frontend build, at least show something
  app.get('/', (req, res) => {
    res.status(200).send('SHFantasy backend is running. Frontend not built.');
  });
}

function demoPools() {
  // Minimal demo structure; front-end should stop throwing fetch error
  const now = Date.now();
  return [
    {
      id: 'demo-today',
      title: 'Demo Pool (Today)',
      lock_ts: now + 60 * 60 * 1000,
      status: 'open'
    },
    {
      id: 'demo-tomorrow',
      title: 'Demo Pool (Tomorrow)',
      lock_ts: now + 25 * 60 * 60 * 1000,
      status: 'open'
    }
  ];
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
