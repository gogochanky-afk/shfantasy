// index.js
// SH Fantasy - Express server with DATA_MODE support
// DATA_MODE=DEMO (default) | LIVE

const express = require("express");

// Routes
const playersRoute = require("./routes/players");
const lineupRoute  = require("./routes/lineup");
const poolsRoute   = require("./routes/pools");
const joinRoute    = require("./routes/join");
const adminRoute   = require("./routes/admin");

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Health checks (MUST be 200) ----
app.get("/healthz", function(req, res) {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    dataMode: process.env.DATA_MODE || "DEMO",
    ts: new Date().toISOString(),
  });
});

app.get("/api/healthz", function(req, res) {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    dataMode: process.env.DATA_MODE || "DEMO",
    ts: new Date().toISOString(),
  });
});

// ---- API routes ----
app.use("/api/pools",   poolsRoute);
app.use("/api/players", playersRoute);
app.use("/api/lineup",  lineupRoute);
app.use("/api/join",    joinRoute);
app.use("/api/admin",   adminRoute);

// Root
app.get("/", function(req, res) {
  res.status(200).send("shfantasy api");
});

// 404 JSON for any unmatched /api/* routes
app.use("/api", function(req, res) {
  res.status(404).json({
    ok: false,
    error: "API_ROUTE_NOT_FOUND",
    method: req.method,
    path: req.path,
  });
});

// Generic error handler
app.use(function(err, req, res, next) {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: "INTERNAL_SERVER_ERROR",
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, function() {
  console.log("shfantasy listening on " + PORT + " (DATA_MODE=" + (process.env.DATA_MODE || "DEMO") + ")");
});
