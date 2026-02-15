import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Leaderboard() {
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [gameStatus, setGameStatus] = useState(null);
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

  // Fetch leaderboard and game status
  const fetchData = () => {
    if (!selectedPool) return;

    Promise.all([
      fetch(`/api/leaderboard?pool_id=${selectedPool.pool_id}`).then((r) => r.json()),
      fetch(`/api/games/status?poolId=${selectedPool.pool_id}`).then((r) => r.json()),
    ])
      .then(([leaderboardData, statusData]) => {
        if (leaderboardData.ok) {
          setLeaderboard(leaderboardData);
        }
        if (statusData.ok) {
          setGameStatus(statusData);
        }
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
      });
  };

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!selectedPool) return;

    // Initial fetch
    fetchData();

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) {
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-refresh interval
    const refreshInterval = setInterval(() => {
      fetchData();
      setNextRefreshIn(60);
    }, 60 * 1000);

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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: "20px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: "20px" }}>
        <div style={{ background: "#2a1a1a", border: "1px solid #ff4444", padding: "15px", borderRadius: "8px" }}>
          <p>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const statusBadge = gameStatus?.status === "live" ? (
    <div style={{ background: "#4ade80", color: "#000", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      🟢 LIVE
    </div>
  ) : gameStatus?.status === "final" ? (
    <div style={{ background: "#888", color: "#fff", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      ✓ FINAL
    </div>
  ) : gameStatus?.status === "scheduled" ? (
    <div style={{ background: "#ff9800", color: "#fff", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      ⏱️ SCHEDULED
    </div>
  ) : (
    <div style={{ background: "#ff4444", color: "#fff", padding: "6px 16px", borderRadius: "4px", fontSize: "0.9rem", fontWeight: "bold" }}>
      🔒 LOCKED
    </div>
  );

  const hotStreaks = leaderboard?.hot_streaks || [];

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: "20px" }}>
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
              {gameStatus?.period && (
                <span>Q{gameStatus.period} - {gameStatus.clock}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "20px", color: "#888", fontSize: "0.9rem" }}>
              <span>Last updated: {leaderboard?.updated_at ? new Date(leaderboard.updated_at).toLocaleTimeString() : "N/A"}</span>
              <span>Next refresh in: {nextRefreshIn}s</span>
            </div>
          </div>
        )}

        {/* Hot Streak Section */}
        {hotStreaks.length > 0 && (
          <div style={{ background: "#2a1a1a", border: "2px solid #ff6600", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "15px", color: "#ff6600" }}>
              🔥 Hot Streak Now
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {hotStreaks.slice(0, 3).map((streak, index) => {
                const minutes = Math.floor(streak.ends_in_seconds / 60);
                const seconds = streak.ends_in_seconds % 60;
                return (
                  <div
                    key={index}
                    style={{
                      background: "#1a1a1a",
                      padding: "12px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", color: "#ff6600" }}>
                        {streak.player_name || streak.player_id}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#888" }}>
                        {streak.multiplier}x multiplier • {streak.trigger_note}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#ff6600" }}>
                      Ends in {minutes}:{String(seconds).padStart(2, "0")}
                    </div>
                  </div>
                );
              })}
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
                    <th style={{ padding: "15px", textAlign: "right", color: "#888" }}>Bonus</th>
                    <th style={{ padding: "15px", textAlign: "right", color: "#888" }}>Total</th>
                    <th style={{ padding: "15px", textAlign: "right", color: "#888" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((row) => {
                    const hasHotStreak = row.players.some((pid) =>
                      hotStreaks.some((s) => s.player_id === pid)
                    );
                    return (
                      <tr key={row.entry_id} style={{ borderBottom: "1px solid #333" }}>
                        <td style={{ padding: "15px" }}>
                          {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
                        </td>
                        <td style={{ padding: "15px" }}>
                          {row.username} {hasHotStreak && <span style={{ color: "#ff6600" }}>🔥</span>}
                        </td>
                        <td style={{ padding: "15px", textAlign: "right" }}>{row.points_total.toFixed(1)}</td>
                        <td style={{ padding: "15px", textAlign: "right", color: "#ff6600" }}>
                          {row.hot_streak_bonus_total > 0 ? `+${row.hot_streak_bonus_total.toFixed(1)}` : "-"}
                        </td>
                        <td style={{ padding: "15px", textAlign: "right", fontWeight: "bold", color: "#4ade80" }}>
                          {row.total_score.toFixed(1)}
                        </td>
                        <td style={{ padding: "15px", textAlign: "right" }}>{row.total_cost}</td>
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
