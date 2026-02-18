const express = require("express");
const path = require("path");

const { initDb } = require("./db/database");
const poolsRoutes = require("./routes/pools");
const joinRoutes = require("./routes/join");

const app = express();

app.use(express.json());

// init DB + seed demo pools
initDb();

// health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api", poolsRoutes);
app.use("/api", joinRoutes);

// serve frontend (public/)
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
