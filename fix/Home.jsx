import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then(res => res.json())
      .then(data => {
        setGames(data.games || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("API error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 20, background: "#0b0b0b", minHeight: "100vh", color: "#fff" }}>
      <h1>🔥 SH Fantasy Arena</h1>
      <h2>Today's Games</h2>

      {loading && <p style={{ color: "#888" }}>Loading games...</p>}

      {!loading && games.length === 0 && (
        <p style={{ color: "#888" }}>No games today. Check back on game days!</p>
      )}

      {games.map(game => (
        <div key={game.id} style={{
          marginBottom: 15,
          background: "#1a1a1a",
          padding: 16,
          borderRadius: 8,
          border: "1px solid #333"
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
            {game.awayTeamFull || game.awayTeam} @ {game.homeTeamFull || game.homeTeam}
          </div>
          <div style={{ color: "#888", fontSize: "0.85rem", marginTop: 4 }}>
            {game.status} {game.time}
          </div>
          <Link to="/arena">
            <button style={{
              marginTop: 10,
              padding: "8px 18px",
              background: "#4ade80",
              color: "#000",
              border: "none",
              borderRadius: 6,
              fontWeight: "bold",
              cursor: "pointer"
            }}>
              Enter Arena
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}
