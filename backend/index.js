import express from "express";
import cors from "cors";
// SHFantasy Backend v2.1 - BDL Bearer Fix
import playersRoute from "./routes/players.js";
import poolsRoute from "./routes/pools.js";
import entryRoute from "./routes/entry.js";
import lineupsRoute from "./routes/lineups.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/players",    playersRoute);
app.use("/api/pools",      poolsRoute);
app.use("/api/entry",      entryRoute);
app.use("/api",            lineupsRoute);

const BDL_KEY = process.env.BALLDONTLIE_KEY || "";

app.get("/api/games", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const r = await fetch(
      `https://api.balldontlie.io/v1/games?dates[]=${today}&per_page=20`,
      { headers: { Authorization: `Bearer ${BDL_KEY}` } }
    );
    const { data } = await r.json();
    res.json({
      ok: true,
      date: today,
      games: (data || []).map(g => ({
        id: g.id,
        homeTeam: g.home_team.abbreviation,
        awayTeam: g.visitor_team.abbreviation,
        homeTeamFull: g.home_team.full_name,
        awayTeamFull: g.visitor_team.full_name,
        status: g.status,
        time: g.time,
      })),
    });
  } catch (err) {
    res.json({ ok: true, games: [], date: new Date().toISOString().split("T")[0] });
  }
});

app.get("/api/roster", (req, res, next) => {
  req.url = "/";
  playersRoute(req, res, next);
});

app.get("/health", (_req, res) => res.send("OK v2.1"));
app.get("/", (_req, res) => res.send("SHFantasy Backend v2.1"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🔥 SHFantasy v2.1 on port ${PORT}`));