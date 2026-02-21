// routes/pools.js
const express = require("express");
const router = express.Router();

/**
 * GET /api/pools
 * 先回傳 demo pools（之後你再接 DB / bucket）
 */
router.get("/", async (req, res) => {
  // 你之後可以改成：從 DB / storage 讀取 pools
  const DATA_MODE = process.env.DATA_MODE || "DEMO";

  // demo data
  const pools = [
    {
      id: "demo-1",
      title: "Demo Pool (Today)",
      lockAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: "open",
    },
  ];

  res.json({
    ok: true,
    mode: DATA_MODE,
    pools,
  });
});

module.exports = router;
