const express = require("express");
const cors = require("cors");

// Initialize app
const app = express();
app.use(cors());
app.use(express.json());

// ===== ROUTES =====

// ✔ 修正這行！ entries -> entry（你的檔案名）
const entryRoutes = require("./routes/entry");

// 其他 routes（根據你的 backend 結構）
const adminRoutes = require("./routes/admin");
const joinRoutes = require("./routes/join");
const lineupRoutes = require("./routes/lineup");
const playersRoutes = require("./routes/players");
const poolsRoutes = require("./routes/pools");

// ===== REGISTER ROUTES =====

// 你的 API prefix（可改）
app.use("/entry", entryRoutes);
app.use("/admin", adminRoutes);
app.use("/join", joinRoutes);
app.use("/lineup", lineupRoutes);
app.use("/players", playersRoutes);
app.use("/pools", poolsRoutes);

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});