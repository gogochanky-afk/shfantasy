// /index.js
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- API routes (keep your existing ones) ---
// If you already have routes split in files, replace this section with your requires.
// Example:
// app.use("/api", require("./api"));

/**
 * IMPORTANT:
 * 如果你現有係用 app.get("/api/...") 一條條寫，
 * 保留就得；如果你係 require("./api")，就用上面例子。
 */

// --- Static UI ---
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false }));

// Serve UI homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
