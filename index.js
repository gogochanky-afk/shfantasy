// index.js
"use strict";

const express = require("express");
const path = require("path");

// Routes (your repo already has these)
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
  });
});

// --- API routes (统一挂 /api/...) ---
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// --- Static UI ---
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

// Serve UI homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Optional: handle SPA routes (if you have frontend routing)
// app.get("*", (req, res) => {
//   res.sendFile(path.join(publicDir, "index.html"));
// });

// --- 404 handler (returns JSON for API, text for others) ---
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
