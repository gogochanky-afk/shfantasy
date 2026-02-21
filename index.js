// index.js
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

// ---- API routes ----
// IMPORTANT: 所有 API 都統一掛喺 /api/*
// 例如：/api/admin/sync、/api/pools、/api/join
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// ---- Health check ----
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
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

// SPA fallback (如果你前端係單頁應用，refresh /xxx 唔會 404)
app.get("*", (req, res) => {
  // 如果係 /api/* 就交由上面 routes（其實上面已經處理咗）
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "API route not found" });
  }
  return res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
