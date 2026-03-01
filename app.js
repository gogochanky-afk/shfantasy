const express = require("express");
const cors = require("cors");
require("dotenv").config();

const poolsRoute = require("./routes/pools");
const entriesRoute = require("./routes/entry");
const joinRoute = require("./routes/join");
const playersRoute = require("./routes/players");
const myEntriesRoute = require("./routes/lineups");

const app = express();

app.use(cors());
app.use(express.json());

// Health Check
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy-backend",
    ts: new Date().toISOString(),
  });
});

// API Routes
app.use("/v1/pools", poolsRoute);
app.use("/v1/entries", entriesRoute);
app.use("/v1/join", joinRoute);
app.use("/v1/players", playersRoute);
app.use("/v1/my-entries", myEntriesRoute);

module.exports = app;
