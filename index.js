// /index.js
const express = require("express");
const path = require("path");

// Routes
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

const app = express();

// ---- Core middleware ----
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- Debug / health ----
// IMPORTANT: 用嚟確認「而家你打到嘅係邊個 revision」
// 你見到 JSON 就代表 Express 真係收到了 request（唔係 Google 404 backend）
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
    host: req.headers.host,
    path: req.path,
  });
});

// 有時前面 proxy / LB 會 probe 呢種路徑；加返可視化 debug
app.get("/__whoami", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
    ip: req.ip,
    ua: req.headers["user-agent"] || "",
    host: req.headers.host,
  });
});

// ---- API routes ----
// IMPORTANT: 所有 API 統一掛喺 /api
// 你 Hoppscotch 打 /api/admin/sync 就一定會落到 routes/admin.js
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// ---- Static UI ----
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

// Serve UI homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// SPA fallback (如果你係 single-page app)
// 任何非 /api 的路徑，都回 index.html，避免 404
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---- 404 for API ----
app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API_ROUTE_NOT_FOUND",
    method: req.method,
    path: req.path,
  });
});

// ---- Start server ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`shfantasy listening on :${PORT}`);
});
