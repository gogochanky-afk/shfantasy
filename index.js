"use strict";

// index.js — SH Fantasy Snapshot Playtest Mode
// Zero DB / sqlite / sportradar dependencies.

const express = require("express");
const path    = require("path");

const poolsRoute   = require("./routes/pools");
const playersRoute = require("./routes/players");
const joinRoute    = require("./routes/join");
const lineupRoute  = require("./routes/lineup");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/healthz", function (req, res) {
  res.json({ ok: true, mode: "SNAPSHOT", ts: new Date().toISOString() });
});
app.get("/api/healthz", function (req, res) {
  res.json({ ok: true, mode: "SNAPSHOT", ts: new Date().toISOString() });
});

// ── API ──────────────────────────────────────────────────────────────────────
app.use("/api/pools",   poolsRoute);
app.use("/api/players", playersRoute);
app.use("/api/join",    joinRoute);
app.use("/api/lineup",  lineupRoute);

// ── Compat (no /api prefix) ──────────────────────────────────────────────────
app.use("/pools",   poolsRoute);
app.use("/players", playersRoute);

// ── Static UI ────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use(function (req, res) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND", path: req.path });
  }
  res.status(404).send("Not found");
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(function (err, req, res, _next) {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "INTERNAL_SERVER_ERROR" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, function () {
  console.log("shfantasy SNAPSHOT listening on :" + PORT);
});
