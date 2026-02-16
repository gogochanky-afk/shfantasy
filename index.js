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
 * ===== Health check (Cloud Run / Load Balancer friendly) =====
 */
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

/**
 * ===== (Optional) API routes placeholder =====
 * 如果你原本有 /api 的 routes，之後可以再加回。
 * 但就算而家冇任何 /api，都唔會影響 Cloud Run 起得唔起。
 */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong' });
});

/**
 * ===== Serve Frontend build =====
 * 你 Dockerfile 會 build 前端：
 *   cd frontend && pnpm run build
 *
 * 大部分 Vite build 會輸出到：frontend/dist
 */
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');

// 如果 dist 存在，就提供靜態檔案
app.use(express.static(frontendDistPath));

// SPA fallback：任何非 /api 的路徑都回傳 index.html
app.get('*', (req, res) => {
  // 若係 API，就唔應該落到呢度
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: 'API route not found' });
  }

  return res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // 如果 dist/index.html 根本唔存在，顯示清晰錯誤，方便你 debug build 有冇成功
      return res.status(500).send(
        'Frontend build not found. Ensure frontend build outputs to frontend/dist and is included in the image.'
      );
    }
  });
});

/**
 * ===== IMPORTANT: Cloud Run port =====
 * 必須用 process.env.PORT
 */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[shfantasy] Server listening on port ${PORT}`);
});
