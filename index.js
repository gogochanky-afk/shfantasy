// index.js
"use strict";

const express = require("express");
const path = require("path");

// Routes
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

const app = express();

// --- Core middleware ---
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Health check (ALWAYS exists) ---
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
    // Cloud Run built-ins:
    k_service: process.env.K_SERVICE || null,
    k_revision: process.env.K_REVISION || null,
    k_configuration: process.env.K_CONFIGURATION || null,
    // Helpful:
    node: process.version,
  });
});

// --- API routes (统一挂 /api/...) ---
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// --- Static UI ---
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// --- 404 handler ---
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      error: "NOT_FOUND",
      path: req.path,
    });
  }
  return res.status(404).send("Not Found");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
