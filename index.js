"use strict";
/**
 * index.js — SH Fantasy Express Server
 * Stable Trial Mode: DATA_MODE=SNAPSHOT by default.
 * Zero DB / zero Sportradar in SNAPSHOT mode.
 */
const express = require("express");
const path    = require("path");
const { DATA_MODE } = require("./lib/dataMode");

const poolsRoute   = require("./routes/pools");
const playersRoute = require("./routes/players");
const joinRoute    = require("./routes/join");
const lineupRoute  = require("./routes/lineup");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health checks ─────────────────────────────────────────────────────────────
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

// ── Back-compat routes (no redirect, same handler) ────────────────────────────
app.use("/pools",   poolsRoute);
app.use("/players", playersRoute);

// ── Static files ──────────────────────────────────────────────────────────────
var publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));
app.get("/", function(req, res) {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ── 404 for unmatched /api/* ──────────────────────────────────────────────────
app.use("/api", function(req, res) {
  res.status(404).json({ ok:false, error:"API_ROUTE_NOT_FOUND", method:req.method, path:req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(function(err, req, res, next) {
  console.error("[ERROR]", err.message || err);
  res.status(500).json({ ok:false, error:"INTERNAL_SERVER_ERROR" });
});

var PORT = process.env.PORT || 8080;
app.listen(PORT, function() {
  console.log("shfantasy listening on " + PORT + " (DATA_MODE=" + DATA_MODE + ")");
});
