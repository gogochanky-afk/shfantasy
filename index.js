"use strict";
/**
 * index.js — SH Fantasy Express Server
 * Snapshot Playtest Mode: zero DB, zero Sportradar, zero better-sqlite3.
 * DATA_MODE defaults to "SNAPSHOT".
 */

const express = require("express");
const path    = require("path");

const DATA_MODE = (process.env.DATA_MODE || "SNAPSHOT").toUpperCase();

// ── Routes ────────────────────────────────────────────────────────────────────
const poolsRoute   = require("./routes/pools");
const playersRoute = require("./routes/players");
const joinRoute    = require("./routes/join");
const lineupRoute  = require("./routes/lineup");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health checks (A1, A2) ────────────────────────────────────────────────────
function healthHandler(req, res) {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    dataMode: DATA_MODE,
    ts: new Date().toISOString()
  });
}
app.get("/healthz",     healthHandler);
app.get("/api/healthz", healthHandler);

// ── Canonical API routes ──────────────────────────────────────────────────────
app.use("/api/pools",   poolsRoute);
app.use("/api/players", playersRoute);
app.use("/api/join",    joinRoute);
app.use("/api/lineup",  lineupRoute);

// ── Compatibility routes (A9): /pools and /players dispatch to same handlers ──
app.use("/pools",   poolsRoute);
app.use("/players", playersRoute);

// ── Static files ──────────────────────────────────────────────────────────────
var publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

app.get("/", function (req, res) {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ── 404 for unmatched /api/* ──────────────────────────────────────────────────
app.use("/api", function (req, res) {
  res.status(404).json({ ok: false, error: "API_ROUTE_NOT_FOUND", method: req.method, path: req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(function (err, req, res, next) {
  console.error("[ERROR]", err.message || err);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
var PORT = process.env.PORT || 8080;
app.listen(PORT, function () {
  console.log("shfantasy listening on " + PORT + " (DATA_MODE=" + DATA_MODE + ")");
});
