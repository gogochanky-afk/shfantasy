import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [pools, setPools] = useState([]);
  const [mode, setMode] = useState("DEMO");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/pools");
      const data = await res.json();
      setPools(data.pools || []);
      setMode(data.mode || "DEMO");
    }
    load();
  }, []);

  return (
    <div style={{ padding: 30, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 32 }}>🔥 SH Fantasy Arena</h1>

      <div style={{ marginBottom: 20, opacity: 0.7 }}>
        Mode: <b>{mode}</b>
      </div>

      <h2>Today + Tomorrow Pools</h2>

      {pools.map((pool) => (
        <div
          key={pool.id}
          style={{
            background: "#111",
            color: "white",
            padding: 20,
            borderRadius: 12,
            marginBottom: 15,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: "bold" }}>
            {pool.name}
          </div>

          <div style={{ marginTop: 8 }}>
            Salary Cap: {pool.salaryCap} | Roster Size: {pool.rosterSize}
          </div>

          <Link to={`/arena/${pool.id}`}>
            <button
              style={{
                marginTop: 15,
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "orange",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Enter Arena
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}
