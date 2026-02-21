const express = require("express");
const router = express.Router();

router.post("/sync", (req, res) => {
  const token = req.headers["x-admin-token"];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev";

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return res.json({
    ok: true,
    message: "Sync route is working"
  });
});

module.exports = router;
