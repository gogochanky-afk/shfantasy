// index.js
// SH Fantasy - minimal stable Express server with health checks
// Full-file replacement

const express = require("express");
const cors = require("cors");

// Routes
const playersRoute = require("./routes/players");
const lineupRoute = require("./routes/lineup");

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// ---- Health checks (MUST be 200) ----
// For Cloud Run / uptime checks
app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
  });
});

// Optional: health under /api too (won’t hurt)
app.get("/api/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "shfantasy",
    ts: new Date().toISOString(),
  });
});

// ---- API routes ----
app.use("/api/players", playersRoute);
app.use("/api/lineup", lineupRoute);

// Root (optional)
app.get("/", (req, res) => {
  res.status(200).send("shfantasy api");
});

// 404 JSON for API routes (avoid Google-style 404 confusion)
app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API_ROUTE_NOT_FOUND",
    method: req.method,
    path: req.path,
  });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: "INTERNAL_SERVER_ERROR",
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`shfantasy listening on ${PORT}`);
});
