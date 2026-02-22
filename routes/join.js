// routes/join.js
const express = require("express");
const router = express.Router();

/**
 * POST /api/join
 * Body: { username, poolId, lineup?: [...] }
 *
 * ✅ 成功回應必須包含：ok: true, entryId, poolId
 * ✅ 錯誤回應必須包含：ok: false, error
 */
router.post("/", async (req, res) => {
  try {
    const { username, poolId, lineup } = req.body || {};

    // 基本驗證：缺欄位就 400
    if (!username || !poolId) {
      return res.status(400).json({
        ok: false,
        error: "username and poolId are required",
      });
    }

    // ✅ demo：先生成 entryId（暫時不落 DB）
    // 為咗避免每次都唔同導致前端/entries 難追，先用 deterministic id
    // 如果你想「每次 join 都新 entry」，可以改成 `${poolId}-${Date.now()}`
    const safeUser = String(username).trim().replace(/\s+/g, "_");
    const entryId = `${poolId}-${safeUser}`;

    // ✅ 統一成功回應格式（前端需要 entryId）
    return res.json({
      ok: true,
      entryId,
      poolId,
      // 額外資訊可留，但前端最重要係上面三個
      username: safeUser,
      lineup: Array.isArray(lineup) ? lineup : [],
    });
  } catch (error) {
    console.error("[POST /api/join] Error:", error);
    return res.status(500).json({
      ok: false,
      error: "internal server error",
    });
  }
});

module.exports = router;
