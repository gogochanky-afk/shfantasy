const express = require("express");
const router = express.Router();

// quick ping
router.get("/ping", (req, res) => {
  res.json({ ok: true, message: "admin ping ok", ts: new Date().toISOString() });
});

router.post("/sync", (req, res) => {
  const token = req.headers["x-admin-token"];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!ADMIN_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "ADMIN_TOKEN_NOT_SET",
      hint: "Set Cloud Run env var ADMIN_TOKEN",
    });
  }

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
      hint: "Provide header x-admin-token",
    });
  }

  return res.json({
    ok: true,
    message: "Sync route is working",
    ts: new Date().toISOString(),
  });
});

module.exports = router;
