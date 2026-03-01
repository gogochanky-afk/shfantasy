const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  res.json({ ok: true, message: "join pool (Phase ②)" });
});

module.exports = router;
