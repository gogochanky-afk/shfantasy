import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const location = useLocation();
  const poolId = new URLSearchParams(location.search).get("poolId");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/leaderboard?poolId=${poolId}`);
      const data = await res.json();
      setRows(data.leaderboard || []);
    }
    load();
  }, [poolId]);

  return (
    <div style={{ padding: 30 }}>
      <h1>🏆 Leaderboard</h1>

      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            background: "#111",
            color: "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          #{i + 1} – Score: {r.score}
        </div>
      ))}
    </div>
  );
}
