import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    fetch("https://shfantasy-backend-348817906468.asia-east1.run.app/api/games")
      .then(res => res.json())
      .then(data => setGames(data.games || []))
      .catch(err => console.error("API error:", err));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>🔥 SH Fantasy Arena</h1>
      <h2>Today's Games</h2>

      {games.map(game => (
        <div key={game.id} style={{ marginBottom: 15 }}>
          {game.homeTeam} vs {game.awayTeam}
          <br />
          <Link to="/arena">
            <button style={{ marginTop: 8 }}>Enter Arena</button>
          </Link>
        </div>
      ))}
    </div>
  );
}