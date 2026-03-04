import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Pools API working",
    data: []
  });
});

export default router;