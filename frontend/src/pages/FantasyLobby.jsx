import { useEffect, useState } from "react";

export default function FantasyLobby() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.json())
      .then(d => { setPlayers(d.players || d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 20, background: "#0b0b0b", minHeight: "100vh", color: "#fff" }}>
      <h1>Fantasy Lobby</h1>
      {loading && <p style={{ color: "#888" }}>Loading players...</p>}
      {players.map(p => (
        <div key={p.playerId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", background: "#1a1a1a", padding: "10px 14px", borderRadius: 6 }}>
          <span>{p.name} — {p.team} ({p.position})</span>
          <span style={{ color: "#4ade80", fontWeight: "bold" }}>${p.salary}</span>
        </div>
      ))}
    </div>
  );
}
