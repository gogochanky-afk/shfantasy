// index.js

const express = require("express");
const path = require("path");

const app = express();

// =============================
// Middleware
// =============================
app.use(express.json({ limit: "1mb" }));

// =============================
// Route Imports
// =============================
const adminRoutes = require("./routes/admin");
const poolRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

// =============================
// API Route Registration
// =============================
app.use("/api/admin", adminRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/join", joinRoutes);

// =============================
// Health Check
// =============================
app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

// =============================
// Static Frontend
// =============================
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// =============================
// Server Start
// =============================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
