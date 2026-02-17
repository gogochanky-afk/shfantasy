// frontend/src/pages/Home.jsx
import { useEffect, useState } from "react";

export default function Home() {
  const [pools, setPools] = useState([]);
  const [mode, setMode] = useState("DEMO");

  useEffect(() => {
    async function loadPools() {
      try {
        const res = await fetch("/api/pools");
        const data = await res.json();

        console.log("Pools API response:", data);

        if (data && data.pools) {
          setPools(data.pools);   // ❗ 不再 filter LIVE
          setMode(data.mode || "DEMO");
        }
      } catch (err) {
        console.error("Failed to load pools:", err);
      }
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

      {pools.length === 0 && (
        <div>No pools available.</div>
      )}

      {pools.map(pool => (
        <div
          key={pool.id}
          style={{
            border: "1px solid #333",
            padding: 12,
            marginBottom: 12,
            borderRadius: 8
          }}
        >
          <div><strong>{pool.name}</strong></div>
          <div>Date: {pool.date}</div>
          <div>Lock: {pool.lockAt}</div>
          <div>Cap: {pool.salaryCap}</div>
          <div>Mode: {pool.mode}</div>
        </div>
      ))}
    </div>
  );
}
