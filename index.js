const express = require("express");
const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "SHFantasy" });
});

// Test Route
app.get("/api/test", (req, res) => {
  res.json({ message: "API working 🚀" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
