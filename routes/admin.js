// /routes/admin.js
const express = require("express");
const router = express.Router();

// POST /api/admin/sync
router.post("/sync", (req, res) => {
  const token = req.headers["x-admin-token"];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  // 如果未設 ADMIN_TOKEN，直接報 500（避免你以為 token 問題）
  if (!ADMIN_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "ADMIN_TOKEN is not set in environment variables",
    });
  }

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized (bad x-admin-token)",
    });
  }

  return res.json({
    ok: true,
    message: "Sync route is working",
    ts: new Date().toISOString(),
  });
});

module.exports = router;
