// routes/join.js
const express = require("express");
const router = express.Router();

/**
 * POST /api/join
 * Body: { username, poolId, lineup: [...] }
 * 先做最基本回應，之後再接 DB 寫入
 */
router.post("/", async (req, res) => {
  const { username, poolId, lineup } = req.body || {};

  if (!username || !poolId) {
    return res.status(400).json({
      ok: false,
      error: "username and poolId are required",
    });
  }

  return res.json({
    ok: true,
    message: "Join received (demo)",
    data: {
      username,
      poolId,
      lineup: Array.isArray(lineup) ? lineup : [],
    },
    ts: new Date().toISOString(),
  });
});

module.exports = router;
