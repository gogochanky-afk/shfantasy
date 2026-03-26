// ===== SHFantasy Backend — Full Build =====
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BDL_KEY = process.env.BALLDONTLIE_KEY || "";
const BDL_BASE = "https://api.balldontlie.io/v1";

// ── BallDontLie helper ──────────────────────────────────────────────────────
async function bdlFetch(path) {
  const res = await fetch(`${BDL_BASE}${path}`, {
    headers: { Authorization: BDL_KEY }
  });
  if (!res.ok) throw new Error(`BDL ${res.status}`);
  return res.json();
}

// ── In-memory state ─────────────────────────────────────────────────────────
const entries = [];   // { id, players, totalSalary, score, ts }
let entryCounter = 1;

// ── Static roster (salary game) ─────────────────────────────────────────────
const ROSTER = [
  { playerId: 1,  name: "LeBron James",      team: "LAL", position: "SF", salary: 2.5 },
  { playerId: 2,  name: "Anthony Davis",     team: "LAL", position: "PF", salary: 2.3 },
  { playerId: 3,  name: "Stephen Curry",     team: "GSW", position: "PG", salary: 2.4 },
  { playerId: 4,  name: "Draymond Green",    team: "GSW", position: "PF", salary: 1.6 },
  { playerId: 5,  name: "Jayson Tatum",      team: "BOS", position: "SF", salary: 2.3 },
  { playerId: 6,  name: "Jaylen Brown",      team: "BOS", position: "SG", salary: 2.0 },
  { playerId: 7,  name: "Shai Gilgeous-Alexander", team: "OKC", position: "PG", salary: 2.5 },
  { playerId: 8,  name: "Chet Holmgren",     team: "OKC", position: "C",  salary: 1.8 },
  { playerId: 9,  name: "Tyrese Haliburton", team: "IND", position: "PG", salary: 2.0 },
  { playerId: 10, name: "Pascal Siakam",     team: "IND", position: "PF", salary: 1.9 },
  { playerId: 11, name: "Cade Cunningham",   team: "DET", position: "PG", salary: 2.1 },
  { playerId: 12, name: "Jalen Duren",       team: "DET", position: "C",  salary: 1.5 },
  { playerId: 13, name: "Joel Embiid",       team: "PHI", position: "C",  salary: 2.4 },
  { playerId: 14, name: "Tyrese Maxey",      team: "PHI", position: "PG", salary: 2.0 },
  { playerId: 15, name: "Kevin Durant",      team: "PHX", position: "SF", salary: 2.3 },
  { playerId: 16, name: "Devin Booker",      team: "PHX", position: "SG", salary: 2.1 },
  { playerId: 17, name: "Giannis Antetokounmpo", team: "MIL", position: "PF", salary: 2.5 },
  { playerId: 18, name: "Damian Lillard",    team: "MIL", position: "PG", salary: 2.1 },
  { playerId: 19, name: "Luka Doncic",       team: "DAL", position: "PG", salary: 2.5 },
  { playerId: 20, name: "Kyrie Irving",      team: "DAL", position: "PG", salary: 2.0 },
];

// ── Pool lifecycle ───────────────────────────────────────────────────────────
let pool = resetPool();

function resetPool() {
  return {
    id: Date.now(),
    status: "OPEN",
    openAt: Date.now(),
    lockAt: Date.now() + 5 * 60 * 1000,   // 5 min open
    closeAt: Date.now() + 15 * 60 * 1000, // 10 min locked → score
  };
}

function tickPool() {
  const now = Date.now();
  if (pool.status === "OPEN" && now >= pool.lockAt) {
    pool.status = "LOCKED";
    console.log("[pool] LOCKED");
    // Simulate scores after lock
    setTimeout(simulateScores, 10_000);
  } else if (pool.status === "LOCKED" && now >= pool.closeAt) {
    pool.status = "CLOSED";
    console.log("[pool] CLOSED → resetting in 60s");
    setTimeout(() => {
      pool = resetPool();
      entries.length = 0;
      entryCounter = 1;
      console.log("[pool] OPEN (new round)");
    }, 60_000);
  }
}

function simulateScores() {
  entries.forEach(e => {
    e.score = +(e.players.reduce((s, p) => s + p.salary * (8 + Math.random() * 12), 0)).toFixed(1);
  });
  entries.sort((a, b) => b.score - a.score);
}

setInterval(tickPool, 5000);

// ── Routes ───────────────────────────────────────────────────────────────────

// Health
app.get("/health", (_req, res) => res.send("OK"));
app.get("/", (_req, res) => res.send("SHFantasy Backend Running"));

// Today's games from BallDontLie
app.get("/api/games", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const data = await bdlFetch(`/games?dates[]=${today}&per_page=20`);
    const games = (data.data || []).map(g => ({
      id: g.id,
      homeTeam: g.home_team.abbreviation,
      awayTeam: g.visitor_team.abbreviation,
      homeTeamFull: g.home_team.full_name,
      awayTeamFull: g.visitor_team.full_name,
      status: g.status,
      time: g.time,
    }));
    res.json({ ok: true, games, date: today });
  } catch (err) {
    // Fallback: return today's schedule stub so UI doesn't break
    res.json({ ok: true, games: [], date: new Date().toISOString().split("T")[0], note: "BDL unavailable" });
  }
});

// Roster (for Arena picker)
app.get("/api/roster", (_req, res) => {
  res.json({ ok: true, players: ROSTER });
});

// Players (alias)
app.get("/api/players", (_req, res) => {
  res.json({ ok: true, players: ROSTER });
});

// Current pool
app.get("/api/pools", (_req, res) => {
  res.json({
    ok: true,
    pools: [{
      ...pool,
      entryCount: entries.length,
      lockInSeconds: Math.max(0, Math.floor((pool.lockAt - Date.now()) / 1000)),
    }]
  });
});

// Submit entry
app.post("/api/entry", (req, res) => {
  const { players, totalSalary } = req.body;
  if (!players || players.length !== 5) {
    return res.status(400).json({ ok: false, error: "Need exactly 5 players" });
  }
  if (totalSalary > 10) {
    return res.status(400).json({ ok: false, error: "Over salary cap ($10)" });
  }
  if (pool.status !== "OPEN") {
    return res.status(400).json({ ok: false, error: "Pool is not open" });
  }
  const entry = {
    id: entryCounter++,
    players,
    totalSalary,
    score: 0,
    ts: Date.now(),
    poolId: pool.id,
  };
  entries.push(entry);
  res.json({ ok: true, entryId: entry.id });
});

// Leaderboard
app.get("/api/leaderboard", (_req, res) => {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  res.json({
    ok: true,
    leaderboard: sorted.map((e, i) => ({
      rank: i + 1,
      id: e.id,
      score: e.score,
      totalSalary: e.totalSalary,
      players: e.players.map(p => p.name),
    })),
    poolStatus: pool.status,
  });
});

// My entries
app.get("/api/entries", (_req, res) => {
  res.json({ ok: true, entries });
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🔥 SHFantasy running on port ${PORT}`));
