#!/bin/bash
# ============================================================
#  SHFantasy Fix Script — run from ~/shfantasy on Hetzner
#  Fixes: backend routes, nginx proxy, frontend hardcoded IP
# ============================================================
set -e

echo "🔧 Applying SHFantasy fixes..."

# 1. Replace backend/index.js
cp backend/index.js backend/index.js.bak
cat > backend/index.js << 'BACKEND_EOF'
// ===== SHFantasy Backend — Full Build =====
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const BDL_KEY = process.env.BALLDONTLIE_KEY || "";
const BDL_BASE = "https://api.balldontlie.io/v1";

async function bdlFetch(path) {
  const res = await fetch(`${BDL_BASE}${path}`, {
    headers: { Authorization: BDL_KEY }
  });
  if (!res.ok) throw new Error(`BDL ${res.status}`);
  return res.json();
}

const entries = [];
let entryCounter = 1;

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

let pool = resetPool();

function resetPool() {
  return {
    id: Date.now(),
    status: "OPEN",
    openAt: Date.now(),
    lockAt: Date.now() + 5 * 60 * 1000,
    closeAt: Date.now() + 15 * 60 * 1000,
  };
}

function simulateScores() {
  entries.forEach(e => {
    e.score = +(e.players.reduce((s, p) => s + p.salary * (8 + Math.random() * 12), 0)).toFixed(1);
  });
  entries.sort((a, b) => b.score - a.score);
}

function tickPool() {
  const now = Date.now();
  if (pool.status === "OPEN" && now >= pool.lockAt) {
    pool.status = "LOCKED";
    setTimeout(simulateScores, 10_000);
  } else if (pool.status === "LOCKED" && now >= pool.closeAt) {
    pool.status = "CLOSED";
    setTimeout(() => {
      pool = resetPool();
      entries.length = 0;
      entryCounter = 1;
    }, 60_000);
  }
}

setInterval(tickPool, 5000);

app.get("/health", (_req, res) => res.send("OK"));
app.get("/", (_req, res) => res.send("SHFantasy Backend Running"));

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
  } catch {
    res.json({ ok: true, games: [], date: new Date().toISOString().split("T")[0], note: "BDL unavailable" });
  }
});

app.get("/api/roster", (_req, res) => res.json({ ok: true, players: ROSTER }));
app.get("/api/players", (_req, res) => res.json({ ok: true, players: ROSTER }));

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

app.post("/api/entry", (req, res) => {
  const { players, totalSalary } = req.body;
  if (!players || players.length !== 5) return res.status(400).json({ ok: false, error: "Need exactly 5 players" });
  if (totalSalary > 10) return res.status(400).json({ ok: false, error: "Over salary cap" });
  if (pool.status !== "OPEN") return res.status(400).json({ ok: false, error: "Pool not open" });
  const entry = { id: entryCounter++, players, totalSalary, score: 0, ts: Date.now(), poolId: pool.id };
  entries.push(entry);
  res.json({ ok: true, entryId: entry.id });
});

app.get("/api/leaderboard", (_req, res) => {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  res.json({
    ok: true,
    leaderboard: sorted.map((e, i) => ({ rank: i+1, id: e.id, score: e.score, totalSalary: e.totalSalary, players: e.players.map(p => p.name) })),
    poolStatus: pool.status,
  });
});

app.get("/api/entries", (_req, res) => res.json({ ok: true, entries }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🔥 SHFantasy running on port ${PORT}`));
BACKEND_EOF

echo "✅ backend/index.js updated"

# 2. Replace frontend/nginx.conf  
cp frontend/nginx.conf frontend/nginx.conf.bak
cat > frontend/nginx.conf << 'NGINX_EOF'
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass https://shfantasy-backend-348817906468.asia-east1.run.app/api/;
        proxy_http_version 1.1;
        proxy_set_header Host shfantasy-backend-348817906468.asia-east1.run.app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_ssl_server_name on;
    }

    location /assets/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri /index.html;
    }
}
NGINX_EOF

echo "✅ frontend/nginx.conf updated"

# 3. Fix hardcoded IP in Home.jsx
cat > frontend/src/pages/Home.jsx << 'HOME_EOF'
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then(res => res.json())
      .then(data => { setGames(data.games || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 20, background: "#0b0b0b", minHeight: "100vh", color: "#fff" }}>
      <h1>🔥 SH Fantasy Arena</h1>
      <h2>Today's Games</h2>
      {loading && <p style={{ color: "#888" }}>Loading games...</p>}
      {!loading && games.length === 0 && <p style={{ color: "#888" }}>No games today.</p>}
      {games.map(game => (
        <div key={game.id} style={{ marginBottom: 15, background: "#1a1a1a", padding: 16, borderRadius: 8, border: "1px solid #333" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
            {game.awayTeamFull || game.awayTeam} @ {game.homeTeamFull || game.homeTeam}
          </div>
          <div style={{ color: "#888", fontSize: "0.85rem", marginTop: 4 }}>{game.status} {game.time}</div>
          <Link to="/arena">
            <button style={{ marginTop: 10, padding: "8px 18px", background: "#4ade80", color: "#000", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}>
              Enter Arena
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}
HOME_EOF

echo "✅ frontend/src/pages/Home.jsx fixed (removed hardcoded IP)"

# 4. Fix FantasyLobby.jsx if it exists
if [ -f "frontend/src/pages/FantasyLobby.jsx" ]; then
  sed -i 's|fetch("http://5.223.71.42:3000/api/players")|fetch("/api/players")|g' frontend/src/pages/FantasyLobby.jsx
  sed -i 's|fetch("http://5.223.71.42:3000/api/leaderboard")|fetch("/api/leaderboard")|g' frontend/src/pages/FantasyLobby.jsx
  echo "✅ frontend/src/pages/FantasyLobby.jsx fixed"
fi

# 5. Fix frontend/.env (remove quotes from URL)
cat > frontend/.env << 'ENV_EOF'
VITE_APP_VERSION=1.0.0
VITE_BUILD_ID=prod
VITE_API_BASE_URL=https://shfantasy-backend-348817906468.asia-east1.run.app
ENV_EOF

echo "✅ frontend/.env updated"

# 6. Commit and push
git add -A
git commit -m "🔧 Fix: backend routes + nginx proxy + remove hardcoded IP"
git push

echo ""
echo "✅✅✅ All done! Cloud Run will auto-deploy in ~2 min."
echo ""
echo "⚠️  IMPORTANT: Set this env var in Cloud Run backend service:"
echo "    BALLDONTLIE_KEY = 308c2517-e03e-4f9d-b27e-8a41d18d2ef1"
echo ""
echo "Test after deploy:"
echo "  curl https://shfantasy-backend-348817906468.asia-east1.run.app/api/games"
echo "  curl https://shfantasy-backend-348817906468.asia-east1.run.app/api/roster"
echo "  curl https://shfantasy.com/api/pools"
