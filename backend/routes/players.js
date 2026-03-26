import express from "express";

const router = express.Router();
const BDL_KEY = process.env.BALLDONTLIE_KEY || "";

// Salary tiers based on team + position
function assignSalary(player) {
  const stars = [
    "LeBron James", "Stephen Curry", "Giannis Antetokounmpo",
    "Luka Doncic", "Joel Embiid", "Kevin Durant", "Jayson Tatum",
    "Shai Gilgeous-Alexander", "Anthony Edwards", "Nikola Jokic"
  ];
  const name = `${player.first_name} ${player.last_name}`;
  if (stars.includes(name)) return 4;

  const pos = (player.position || "").toUpperCase();
  if (pos === "C") return 3;
  if (pos.includes("F")) return 2.5;
  if (pos.includes("G")) return 2;
  return 1.5;
}

router.get("/", async (_req, res) => {
  try {
    const r = await fetch(
      "https://api.balldontlie.io/v1/players/active?per_page=50",
      { headers: { Authorization: BDL_KEY } }
    );
    if (!r.ok) throw new Error(`BDL ${r.status}`);
    const { data } = await r.json();
    res.json({
      ok: true,
      players: data.map(p => ({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        team: p.team?.abbreviation || "?",
        teamFull: p.team?.full_name || "",
        position: p.position || "G",
        salary: assignSalary(p),
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;