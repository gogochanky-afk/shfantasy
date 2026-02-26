const express = require("express");
const path = require("path");

// Routes
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");
const playersRoutes = require("./routes/players");
const lineupRoutes = require("./routes/lineup");

const app = express();

// ---- Core middleware ----
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- Debug / health ----
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
    host: req.headers.host,
    path: req.path,
  });
});

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
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// ✅ IMPORTANT: Draft page needs these two routes
app.use("/api/players", playersRoutes);
app.use("/api/lineup", lineupRoutes);

// ---- Static UI ----
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// SPA fallback (anything not /api/*)
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
