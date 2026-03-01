// app.js - Core Express App (v1 API)

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const poolsRoute = require("./src/routes/pools");
const authRoute = require("./src/routes/auth");
const entriesRoute = require("./src/routes/entries");
const joinRoute = require("./src/routes/join");
const myEntriesRoute = require("./src/routes/myEntries");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy-backend",
    ts: new Date().toISOString(),
  });
});

// Versioned API
app.use("/v1/pools", poolsRoute);
app.use("/v1/auth", authRoute);
app.use("/v1/entries", entriesRoute);
app.use("/v1/join", joinRoute);
app.use("/v1/my-entries", myEntriesRoute);

module.exports = app;
