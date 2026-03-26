import express from "express";

const router = express.Router();
const BDL_KEY = process.env.BALLDONTLIE_KEY || "";

function salary(pos) {
  if (!pos) return 1.5;
  const p = pos.toUpperCase();
  if (p.includes("C")) return 2.5;
  if (p.includes("F")) return 2.0;
  if (p.includes("G")) return 1.8;
  return 1.5;
}

router.get("/", async (_req, res) => {
  try {
    const r = await fetch("https://api.balldontlie.io/v1/players?per_page=25", {
      headers: { Authorization: BDL_KEY }
    });
    const { data } = await r.json();
    res.json({
      ok: true,
      players: data.map(p => ({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        team: p.team?.abbreviation || "",
        position: p.position || "G",
        salary: salary(p.position),
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
