const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// ---- Boot logs (Cloud Run Logs Explorer 會見到)
console.log("BOOT: index.js loaded");
console.log("BOOT: NODE_ENV=", process.env.NODE_ENV);
console.log("BOOT: PORT=", port);
console.log("BOOT: CWD=", process.cwd());
console.log("BOOT: __dirname=", __dirname);

// ---- Health + Ping
app.get("/healthz", (req, res) => res.status(200).json({ ok: true, service: "shfantasy" }));
app.get("/api/ping", (req, res) => res.status(200).json({ ok: true, message: "pong" }));

// ---- Demo helpers
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function demoGamesFor(dateStr) {
  const base = dateStr.replaceAll("-", "");
  return [
    {
      gameId: `demo-${base}-001`,
      date: dateStr,
      home: { teamId: 1, code: "LAL", name: "Lakers" },
      away: { teamId: 2, code: "GSW", name: "Warriors" },
      startAt: `${dateStr}T11:00:00.000Z`,
      status: "scheduled",
      dataMode: "DEMO",
    },
    {
      gameId: `demo-${base}-002`,
      date: dateStr,
      home: { teamId: 3, code: "BOS", name: "Celtics" },
      away: { teamId: 4, code: "MIA", name: "Heat" },
      startAt: `${dateStr}T13:30:00.000Z`,
      status: "scheduled",
      dataMode: "DEMO",
    },
  ];
}

// ---- API: games/pools (DEMO)
app.get("/api/games", (req, res) => {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const t1 = isoDate(today);
  const t2 = isoDate(tomorrow);
  res.json({
    ok: true,
    mode: "DEMO",
    games: [...demoGamesFor(t1), ...demoGamesFor(t2)],
  });
});

app.get("/api/pools", (req, res) => {
  const lockAt = new Date(Date.now() + 3600 * 1000).toISOString();
  res.json({
    ok: true,
    mode: "DEMO",
    pools: [{ id: "demo-1", name: "Demo Pool", prize: 100, entry: 5, lockAt, mode: "DEMO" }],
  });
});

// ================================
// FRONTEND STATIC (Vite dist)
// ================================
const distDir = path.join(__dirname, "frontend", "dist");
const indexHtml = path.join(distDir, "index.html");

// ✅ Debug endpoint：用嚟「證據式」確認 dist 有冇入到 container
app.get("/api/debug/dist", (req, res) => {
  const existsDist = fs.existsSync(distDir);
  const existsIndex = fs.existsSync(indexHtml);

  let files = [];
  try {
    if (existsDist) files = fs.readdirSync(distDir).slice(0, 200);
  } catch (e) {
    files = [`ERROR: ${String(e)}`];
  }

  console.log("BOOT: distDir=", distDir, "exists=", existsDist);
  console.log("BOOT: indexHtml=", indexHtml, "exists=", existsIndex);

  res.json({
    ok: true,
    distDir,
    existsDist,
    indexHtml,
    existsIndex,
    files,
  });
});

// ✅ 正常情況：dist 存在就 serve
if (fs.existsSync(indexHtml)) {
  console.log("BOOT: Frontend detected ✅ Serving Vite dist");
  app.use(express.static(distDir));

  // SPA fallback：所有非 /api 路徑都回 index.html
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ ok: false, message: "Not found" });
    return res.sendFile(indexHtml);
  });
} else {
  console.log("BOOT: Frontend NOT detected ❌ index.html missing");
  app.get("/", (req, res) => {
    res
      .status(200)
      .send("Backend is running (frontend not built). Try /api/debug/dist or /api/games or /api/pools");
  });
  app.get("*", (req, res) => res.status(404).json({ ok: false, message: "Not found" }));
}

app.listen(port, () => {
  console.log(`BOOT: listening on ${port}`);
});
