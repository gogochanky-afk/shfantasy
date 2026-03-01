const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  res.json({ ok: true, message: "create entry (Phase ②)" });
});

module.exports = router;
