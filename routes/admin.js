// routes/admin.js
const express = require("express");
const router = express.Router();

/**
 * POST /api/admin/sync
 * Header: x-admin-token: <ADMIN_TOKEN>
 * Query: dryRun=true/false (optional)
 */
router.post("/sync", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!ADMIN_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "ADMIN_TOKEN is not set on server",
      });
    }

    if (!token || token !== ADMIN_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    const dryRun = String(req.query.dryRun || "").toLowerCase() === "true";

    // ✅ 先用簡單回應確認 route 正常
    // 之後你要加「真正 sync」邏輯，就寫喺呢度（例如讀 bucket / seed pools）
    return res.json({
      ok: true,
      message: "Admin sync route is working",
      dryRun,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Unknown error",
    });
  }
});

module.exports = router;
