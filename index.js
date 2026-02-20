const express = require("express");
const { Storage } = require("@google-cloud/storage");

const app = express();
const port = process.env.PORT || 8080;

const DATA_MODE = process.env.DATA_MODE || "DEMO";
const BUCKET_NAME = process.env.BUCKET_NAME;

app.get("/", (req, res) => {
  res.send("SH Fantasy Live");
});

app.get("/health.json", async (req, res) => {
  res.json({
    status: "ok",
    mode: DATA_MODE,
    source: DATA_MODE === "LIVE" ? "LIVE_JSON" : "DEMO",
    ts: new Date().toISOString(),
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
