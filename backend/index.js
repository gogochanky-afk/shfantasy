// ===== SHFantasy Backend (Final Version) =====

// Imports
import express from "express";
import cors from "cors";

// Import Routes
import playersRoute from "./routes/players.js";
import poolsRoute from "./routes/pools.js";
import lineupsRoute from "./routes/lineups.js";

// Create app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/players", playersRoute);
app.use("/api/pools", poolsRoute);
app.use("/api/lineups", lineupsRoute);

// Health check (Cloud Run requires this)
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Cloud Run requires listening on process.env.PORT
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🔥 SHFantasy Backend running on PORT ${PORT}`);
});