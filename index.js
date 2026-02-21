// /index.js
const express = require("express");
const path = require("path");

// Routes
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

const app = express();

// ---- Core middleware ----
// Cloud Run / LB 之下建議開 trust proxy（避免某些情況下 header / protocol 判斷怪）
app.set("trust proxy", true);

// Body parser
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- API routes ----
// IMPORTANT: 所有 API 統一掛喺 /api/...
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// ---- Health & debug ----
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
  });
});

// 用嚟確認你而家連到邊個 Cloud Run revision（避免「你以為最新」但其實唔係）
app.get("/__whoami", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    node_env: process.env.NODE_ENV || null,
    port: process.env.PORT || null,
    // Cloud Run 會自動提供：
    k_service: process.env.K_SERVICE || null,
    k_revision: process.env.K_REVISION || null,
    k_configuration: process.env.K_CONFIGURATION || null,
    region_hint: process.env.GOOGLE_CLOUD_REGION || null,
    ts: new Date().toISOString(),
  });
});

// ---- Static UI ----
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

// Serve UI homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// SPA fallback（如果你係單頁 app，避免刷新 404）
// 注意：唔會影響 /api/*、/healthz、/__whoami
app.get("*", (req, res) => {
  // 如果係 API 路徑就唔好兜底
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "API route not found" });
  }
  // 其他路徑當 SPA
  return res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
