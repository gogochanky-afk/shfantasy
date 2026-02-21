// routes/admin.js
"use strict";

const express = require("express");
const router = express.Router();

/**
 * POST /api/admin/sync
 * Header: x-admin-token: <token>
 * Env: ADMIN_TOKEN
 */
router.post("/sync", async (req, res) => {
  const token = req.headers["x-admin-token"];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!ADMIN_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "ADMIN_TOKEN_NOT_SET",
    });
  }

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
    });
  }

  // TODO: put real sync logic here (seed demo pools / fetch data / etc.)
  return res.json({
    ok: true,
    message: "Sync route is working",
    ts: new Date().toISOString(),
  });
});

module.exports = router;
