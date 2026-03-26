// Fantasy scoring: PTS + REB + AST + (STL×2) + (BLK×2) - TO
// Uses BallDontLie /v1/stats endpoint (requires All-Star tier)
// Fallback: salary-weighted simulation if stats unavailable

const BDL_KEY = process.env.BALLDONTLIE_KEY || "";
const BDL_BASE = "https://api.balldontlie.io/v1";

export function calcFantasyScore(stat) {
  const pts = stat.pts || 0;
  const reb = stat.reb || 0;
  const ast = stat.ast || 0;
  const stl = stat.stl || 0;
  const blk = stat.blk || 0;
  const to  = stat.turnover || 0;
  return +(pts + reb + ast + (stl * 2) + (blk * 2) - to).toFixed(1);
}

export async function fetchGameStats(gameId) {
  try {
    const r = await fetch(`${BDL_BASE}/stats?game_ids[]=${gameId}&per_page=100`, {
      headers: { Authorization: BDL_KEY }
    });
    if (!r.ok) return null;
    const { data } = await r.json();
    // Map player_id → fantasy score
    const scores = {};
    for (const s of (data || [])) {
      scores[s.player.id] = calcFantasyScore(s);
    }
    return scores;
  } catch {
    return null;
  }
}

// Fallback when stats API unavailable (free tier)
export function simulateScore(salary) {
  return +(salary * (8 + Math.random() * 12)).toFixed(1);
}