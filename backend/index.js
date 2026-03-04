const express = require("express");
const cors = require("cors");

// Initialize app
const app = express();

// ===== CORS 設定（非常重要） =====
app.use(
  cors({
    origin: [
      "https://shfantasy.com",
      "https://www.shfantasy.com",
      "https://shfantasy-frontend-348817906468.asia-east1.run.app" // Cloud Run 前端 URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());

// ===== ROUTES =====
const entryRoutes = require("./routes/entry");
const adminRoutes = require("./routes/admin");
const joinRoutes = require("./routes/join");
const lineupRoutes = require("./routes/lineup");
const playersRoutes = require("./routes/players");
const poolsRoutes = require("./routes/pools");

// ===== REGISTER ROUTES =====
app.use("/entry", entryRoutes);
app.use("/admin", adminRoutes);
app.use("/join", joinRoutes);
app.use("/lineup", lineupRoutes);
app.use("/players", playersRoutes);
app.use("/pools", poolsRoutes);

// ===== HEALTH CHECK（Cloud Run 需要） =====
app.get("/", (req, res) => {
  res.status(200).send("Backend is running!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});