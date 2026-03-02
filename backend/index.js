"use strict";
/**
 * index.js — SH Fantasy Express Server
 * Stable Trial Mode: DATA_MODE=SNAPSHOT by default.
 */
const express = require("express");
const path    = require("path");
const { DATA_MODE }   = require("./lib/dataMode");
const { ENTRY_STORE } = require("./lib/entryStore");

const poolsRoute   = require("./routes/pools");
const playersRoute = require("./routes/players");
const joinRoute    = require("./routes/join");
const lineupRoute  = require("./routes/lineup");
const entryRoute   = require("./routes/entry");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

function healthHandler(req, res) {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    dataMode: DATA_MODE,
    source: "snapshot",
    entryStore: ENTRY_STORE,
    updatedAt: new Date().toISOString(),
    ts: new Date().toISOString()
  });
}

app.get("/healthz", healthHandler);
app.get("/api/healthz", healthHandler);

// canonical API
app.use("/api/pools",   poolsRoute);
app.use("/api/players", playersRoute);
app.use("/api/join",    joinRoute);
app.use("/api/lineup",  lineupRoute);
app.use("/api/entry",   entryRoute);

app.get("/api/my-entries", function(req, res) {
  req.url = "/my-entries";
  entryRoute(req, res, function(err) {
    if (err) res.status(500).json({ ok:false, error:"Internal server error" });
  });
});

// legacy
app.use("/pools",   poolsRoute);
app.use("/players", playersRoute);

// static
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// unmatched
app.use("/api", (req, res) => {
  res.status(404).json({ ok:false, error:"API_ROUTE_NOT_FOUND", method:req.method, path:req.path });
});

// error
app.use((err, req, res) => {
  console.error("[ERROR]", err.message || err);
  res.status(500).json({ ok:false, error:"INTERNAL_SERVER_ERROR" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("shfantasy backend running on " + PORT + " (DATA_MODE=" + DATA_MODE + ")");
});
