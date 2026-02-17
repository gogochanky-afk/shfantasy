import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const location = useLocation();
  const poolId = new URLSearchParams(location.search).get("pool");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/leaderboard/${poolId}`);
      const data = await res.json();
      setRows(data.leaderboard || []);
    }
    load();
  }, [poolId]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Leaderboard</h2>
      {rows.map((r, i) => (
        <div key={r.id}>
          #{i + 1} — Score: {r.score}
        </div>
      ))}
    </div>
  );
}
