const express = require("express");
const router = express.Router();

router.post("/register", async (req, res) => {
  res.json({ ok: true, message: "register (coming in Phase ②)" });
});

router.post("/login", async (req, res) => {
  res.json({ ok: true, message: "login (coming in Phase ②)" });
});

module.exports = router;
