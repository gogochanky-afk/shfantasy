import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Leaderboard() {
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataMode, setDataMode] = useState("unknown");
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Fetch pools
  useEffect(() => {
    fetch("/api/pools")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.pools.length > 0) {
          setPools(data.pools);
          setSelectedPool(data.pools[0]);
          setDataMode(data.data_mode);
        } else {
          setError("No pools available");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Fetch leaderboard
  const fetchData = () => {
    if (!selectedPool) return;

    fetch(`/api/leaderboard?pool_id=${selectedPool.pool_id}`)
      .then((r) => r.json())
      .then((leaderboardData) => {
        if (leaderboardData.ok) {
          setLeaderboard(leaderboardData);
        }
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      });
  };

  // Auto-refresh: 5s when LOCKED, 60s otherwise
  useEffect(() => {
    if (!selectedPool) return;

    // Determine refresh interval based on pool status
    const isLocked = selectedPool.status === 'LOCKED';
    const refreshDuration = isLocked ? 5 : 60; // 5s when locked, 60s otherwise

    // Initial fetch
    fetchData();
    setNextRefreshIn(refreshDuration);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) {
          return refreshDuration;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-refresh interval
    const refreshInterval = setInterval(() => {
      fetchData();
      setNextRefreshIn(refreshDuration);
    }, refreshDuration * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearInterval(refreshInterval);
    };
  }, [selectedPool]);

  const toggleRow = (entryId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedRows(newExpanded);
  };

  // Simulate hot streak data (client-side only for demo)
  const getHotStreak = (username) => {
    // Simple hash to generate consistent streak for demo
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 7 >= 4 ? (hash % 5) + 3 : 0; // 3-7 streak or 0
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #12131a 100%)", color: "#fff", padding: "80px 20px 20px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #12131a 100%)", color: "#fff", padding: "80px 20px 20px" }}>
        <div style={{ background: "#2a1a1a", border: "1px solid #ff4444", padding: "15px", borderRadius: "8px" }}>
          <p>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const statusBadge = selectedPool?.status === "OPEN" ? (
    <div style={{ background: "#4ade80", color: "#000", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      🟢 LIVE
    </div>
  ) : selectedPool?.status === "LOCKED" ? (
    <div style={{ background: "#ff4444", color: "#fff", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      🔒 LOCKED
    </div>
  ) : (
    <div style={{ background: "#888", color: "#fff", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      ✓ CLOSED
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #12131a 100%)", color: "#fff", padding: "80px 20px 20px" }}>
      <header style={{ marginBottom: "30px", borderBottom: "1px solid #333", paddingBottom: "15px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>🏆 Leaderboard</h1>
          <div style={{ 
            background: dataMode === "demo" ? "#444" : "#2a4a2a", 
            color: dataMode === "demo" ? "#aaa" : "#4ade80",
            padding: "4px 12px", 
            borderRadius: "4px",
            fontSize: "0.9rem",
            fontWeight: "bold"
          }}>
            {dataMode.toUpperCase()}
          </div>
        </div>
        <nav style={{ display: "flex", gap: "15px" }}>
          <Link to="/" style={{ color: "#888", textDecoration: "none" }}>Home</Link>
          <Link to="/arena" style={{ color: "#888", textDecoration: "none" }}>Arena</Link>
          <Link to="/my-entries" style={{ color: "#888", textDecoration: "none" }}>My Entries</Link>
          <Link to="/how-it-works" style={{ color: "#888", textDecoration: "none" }}>How It Works</Link>
        </nav>
      </header>

      <main>
        {/* Pool Selector */}
        {pools.length > 1 && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "#888" }}>
              Select Pool:
            </label>
            <select
              value={selectedPool?.pool_id || ""}
              onChange={(e) => {
                const pool = pools.find((p) => p.pool_id === e.target.value);
                setSelectedPool(pool);
              }}
              style={{
                width: "100%",
                padding: "12px",
                background: "#1a1a1a",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: "8px",
                fontSize: "1rem",
              }}
            >
              {pools.map((pool) => (
                <option key={pool.pool_id} value={pool.pool_id}>
                  {pool.home.abbr} vs {pool.away.abbr} - {new Date(pool.lock_time).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pool Info */}
        {selectedPool && (
          <div style={{ background: "#1a1a1a", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h2 style={{ fontSize: "1.5rem" }}>
                {selectedPool.home.abbr} vs {selectedPool.away.abbr}
              </h2>
              {statusBadge}
            </div>
            <div style={{ display: "flex", gap: "20px", color: "#888", fontSize: "0.9rem", marginBottom: "10px" }}>
              <span>Lock Time: {new Date(selectedPool.lock_time).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", gap: "20px", color: "#888", fontSize: "0.9rem" }}>
              <span>Last updated: {leaderboard?.updated_at ? new Date(leaderboard.updated_at).toLocaleTimeString() : "N/A"}</span>
              <span>Next refresh in: {nextRefreshIn}s</span>
            </div>
          </div>
        )}



        {/* Leaderboard Table */}
        {leaderboard && leaderboard.rows.length > 0 ? (
          <div style={{ background: "#1a1a1a", borderRadius: "8px", overflow: "hidden" }}>
            {/* Desktop Table */}
            <div style={{ display: "block" }} className="desktop-table">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#222", borderBottom: "1px solid #333" }}>
                    <th style={{ padding: "15px", textAlign: "left", color: "#888" }}>Rank</th>
                    <th style={{ padding: "15px", textAlign: "left", color: "#888" }}>Username</th>
                    <th style={{ padding: "15px", textAlign: "right", color: "#888" }}>Score</th>
                    <th style={{ padding: "15px", textAlign: "right", color: "#888" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row) => {
                    const hotStreak = getHotStreak(row.username);
                    const isTop3 = row.rank <= 3;
                    const glowColor = row.rank === 1 ? 'rgba(255, 215, 0, 0.15)' : row.rank === 2 ? 'rgba(192, 192, 192, 0.15)' : row.rank === 3 ? 'rgba(205, 127, 50, 0.15)' : 'transparent';
                    
                    return (
                      <tr 
                        key={row.entry_id} 
                        style={{ 
                          borderBottom: "1px solid #333",
                          background: isTop3 ? glowColor : 'transparent',
                          animation: isTop3 ? 'glowPulse 5s infinite' : 'none',
                        }}
                      >
                        <td style={{ padding: "15px" }}>
                          {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
                        </td>
                        <td style={{ padding: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{row.username}</span>
                          {hotStreak >= 3 && (
                            <span style={{ 
                              fontSize: "0.75rem", 
                              background: "rgba(255, 102, 0, 0.2)",
                              border: "1px solid #ff6600",
                              color: "#ff6600",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: "bold",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              animation: "flamePulse 1.5s infinite"
                            }}>
                              🔥 HOT STREAK x{hotStreak}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "15px", textAlign: "right", fontWeight: "bold", color: "#4ade80" }}>
                          {row.score.toFixed(1)}
                        </td>
                        <td style={{ padding: "15px", textAlign: "right" }}>{row.total_cost}/10</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ background: "#1a1a1a", padding: "40px", borderRadius: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>No entries yet</p>
            <Link
              to="/arena"
              style={{
                display: "inline-block",
                background: "#4ade80",
                color: "#000",
                padding: "12px 24px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              Enter Arena
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
