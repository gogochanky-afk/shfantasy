import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Leaderboard() {
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataMode, setDataMode] = useState("unknown");
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

  // Fetch leaderboard when pool changes
  useEffect(() => {
    if (!selectedPool) return;

    setLeaderboard(null);
    setLoading(true);

    fetch(`/api/leaderboard?pool_id=${selectedPool.pool_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setLeaderboard(data);
        } else {
          setError("Failed to load leaderboard");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
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

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#0b0b0b", 
      color: "#fff", 
      padding: "20px" 
    }}>
      <header style={{ 
        marginBottom: "30px", 
        borderBottom: "1px solid #333", 
        paddingBottom: "15px" 
      }}>
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
        {loading && <p>Loading leaderboard...</p>}
        {error && (
          <div style={{ 
            background: "#2a1a1a", 
            border: "1px solid #ff4444", 
            padding: "15px", 
            borderRadius: "8px" 
          }}>
            <p>⚠️ {error}</p>
          </div>
        )}
        
        {selectedPool && leaderboard && (
          <div>
            {/* Pool Selector */}
            {pools.length > 1 && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", color: "#888" }}>
                  Select Pool:
                </label>
                <select
                  value={selectedPool.pool_id}
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
            <div style={{ 
              background: "#1a1a1a", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "30px" 
            }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>
                {selectedPool.home.abbr} vs {selectedPool.away.abbr}
              </h2>
              <div style={{ display: "flex", gap: "20px", color: "#888", fontSize: "0.9rem" }}>
                <span>Updated: {new Date(leaderboard.updated_at).toLocaleString()}</span>
                <span>Entries: {leaderboard.rows.length}</span>
              </div>
            </div>

            {/* Leaderboard Table */}
            {leaderboard.rows.length === 0 ? (
              <div style={{ 
                background: "#1a1a1a", 
                padding: "40px", 
                borderRadius: "8px", 
                textAlign: "center" 
              }}>
                <p style={{ fontSize: "1.2rem", color: "#888", marginBottom: "10px" }}>
                  No entries yet
                </p>
                <p style={{ color: "#666" }}>
                  Be the first to enter this pool!
                </p>
                <Link to="/arena">
                  <button style={{
                    marginTop: "20px",
                    padding: "12px 24px",
                    background: "#4ade80",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}>
                    Enter Arena
                  </button>
                </Link>
              </div>
            ) : (
              <div style={{ 
                background: "#1a1a1a", 
                borderRadius: "8px", 
                overflow: "hidden" 
              }}>
                {/* Desktop Table */}
                <div style={{ 
                  display: window.innerWidth > 768 ? "block" : "none",
                  overflowX: "auto" 
                }}>
                  <table style={{ 
                    width: "100%", 
                    borderCollapse: "collapse" 
                  }}>
                    <thead>
                      <tr style={{ 
                        background: "#222", 
                        borderBottom: "2px solid #333" 
                      }}>
                        <th style={{ padding: "15px", textAlign: "left" }}>Rank</th>
                        <th style={{ padding: "15px", textAlign: "left" }}>Username</th>
                        <th style={{ padding: "15px", textAlign: "right" }}>Score</th>
                        <th style={{ padding: "15px", textAlign: "right" }}>Cost</th>
                        <th style={{ padding: "15px", textAlign: "center" }}>Players</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.rows.map((row) => (
                        <tr 
                          key={row.entry_id}
                          style={{ 
                            borderBottom: "1px solid #333",
                            cursor: "pointer",
                            background: expandedRows.has(row.entry_id) ? "#1f1f1f" : "transparent"
                          }}
                          onClick={() => toggleRow(row.entry_id)}
                        >
                          <td style={{ padding: "15px", fontWeight: "bold" }}>
                            {row.rank === 1 && "🥇"}
                            {row.rank === 2 && "🥈"}
                            {row.rank === 3 && "🥉"}
                            {row.rank > 3 && `#${row.rank}`}
                          </td>
                          <td style={{ padding: "15px" }}>{row.username}</td>
                          <td style={{ 
                            padding: "15px", 
                            textAlign: "right",
                            fontWeight: "bold",
                            color: "#4ade80"
                          }}>
                            {row.projected_score}
                          </td>
                          <td style={{ padding: "15px", textAlign: "right" }}>
                            ${row.total_cost}
                          </td>
                          <td style={{ padding: "15px", textAlign: "center" }}>
                            {expandedRows.has(row.entry_id) ? "▼" : "▶"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Expanded Player Details */}
                  {leaderboard.rows.map((row) => 
                    expandedRows.has(row.entry_id) && (
                      <div 
                        key={`${row.entry_id}-details`}
                        style={{ 
                          padding: "20px", 
                          background: "#1f1f1f",
                          borderBottom: "1px solid #333"
                        }}
                      >
                        <h4 style={{ marginBottom: "10px", color: "#888" }}>Players:</h4>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                          gap: "10px" 
                        }}>
                          {row.players.map((player, idx) => (
                            <div 
                              key={idx}
                              style={{ 
                                padding: "8px 12px", 
                                background: "#2a2a2a", 
                                borderRadius: "4px" 
                              }}
                            >
                              {player}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Mobile Cards */}
                <div style={{ 
                  display: window.innerWidth <= 768 ? "block" : "none",
                  padding: "10px"
                }}>
                  {leaderboard.rows.map((row) => (
                    <div 
                      key={row.entry_id}
                      style={{ 
                        background: "#222", 
                        padding: "15px", 
                        borderRadius: "8px", 
                        marginBottom: "10px",
                        cursor: "pointer"
                      }}
                      onClick={() => toggleRow(row.entry_id)}
                    >
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        marginBottom: "10px" 
                      }}>
                        <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
                          {row.rank === 1 && "🥇"}
                          {row.rank === 2 && "🥈"}
                          {row.rank === 3 && "🥉"}
                          {row.rank > 3 && `#${row.rank}`}
                          {" "}{row.username}
                        </span>
                        <span style={{ 
                          fontWeight: "bold", 
                          color: "#4ade80",
                          fontSize: "1.2rem"
                        }}>
                          {row.projected_score}
                        </span>
                      </div>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        color: "#888",
                        fontSize: "0.9rem"
                      }}>
                        <span>Cost: ${row.total_cost}</span>
                        <span>{expandedRows.has(row.entry_id) ? "▼ Hide" : "▶ Show"} Players</span>
                      </div>
                      
                      {expandedRows.has(row.entry_id) && (
                        <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #333" }}>
                          {row.players.map((player, idx) => (
                            <div 
                              key={idx}
                              style={{ 
                                padding: "6px 10px", 
                                background: "#1a1a1a", 
                                borderRadius: "4px",
                                marginBottom: "5px",
                                fontSize: "0.9rem"
                              }}
                            >
                              {player}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
