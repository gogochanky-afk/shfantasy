// /index.js
const express = require("express");
const path = require("path");

// Routes (keep these files in /routes)
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

const app = express();

// ---- Core middleware ----
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- API routes (ALL under /api) ----
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

// UI homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// SPA fallback (optional but helps if frontend routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
