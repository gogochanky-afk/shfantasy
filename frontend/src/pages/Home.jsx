import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [pools, setPools] = useState([]);
  const [mode, setMode] = useState("DEMO");

  useEffect(() => {
    async function loadPools() {
      const res = await fetch("/api/pools");
      const data = await res.json();
      setPools(data.pools || []);
      setMode(data.mode || "DEMO");
    }
    loadPools();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>SH Fantasy</h1>

      <div style={{ marginBottom: 20 }}>
        <strong>DATA_MODE:</strong> {mode}
      </div>

      <h2>Today + Tomorrow Pools</h2>

      {pools.length === 0 && <div>No pools available.</div>}

      {pools.map(pool => (
        <div
          key={pool.id}
          style={{
            border: "1px solid #333",
            padding: 12,
            marginBottom: 12
          }}
        >
          <div><strong>{pool.name}</strong></div>
          <div>Salary Cap: {pool.salaryCap}</div>
          <div>Roster Size: {pool.rosterSize}</div>

          <Link to={`/arena/${pool.id}`}>
            <button style={{ marginTop: 10 }}>
              Enter Arena
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}
