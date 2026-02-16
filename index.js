const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// health check
app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

// ping
app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

// pools endpoint
app.get("/api/pools", (req, res) => {
  res.json({
    ok: true,
    pools: [
      {
        id: "demo-1",
        name: "Demo Pool",
        prize: 100,
        entry: 5
      }
    ]
  });
});

// fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Not found" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
