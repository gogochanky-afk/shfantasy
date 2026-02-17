import { useEffect, useState } from "react";

export default function Arena() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/games");
        const data = await res.json();
        setGames(data.games || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>🔥 SH Fantasy Arena</h1>
      <p>Mode: DEMO</p>

      {loading && <p>Loading games...</p>}

      {!loading && games.length === 0 && (
        <p>No games available.</p>
      )}

      {games.map((g) => (
        <div
          key={g.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 12,
            borderRadius: 8
          }}
        >
          <h3>
            {g.homeTeam} vs {g.awayTeam}
          </h3>
          <p>Date: {g.date}</p>
          <p>Status: {g.status}</p>
        </div>
      ))}
    </div>
  );
}
