const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  res.json({ ok: true, message: "my entries (Phase ②)" });
});

module.exports = router;
