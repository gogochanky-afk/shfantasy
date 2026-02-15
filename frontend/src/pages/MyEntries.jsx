import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function MyEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEntries = () => {
    setRefreshing(true);
    fetch("/api/entries")
      .then((res) => {
        if (!res.ok) throw new Error("API not ready");
        return res.json();
      })
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchEntries();
  }, []);

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
          <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
            📋 My Entries
          </h1>
          <button
            onClick={fetchEntries}
            disabled={refreshing}
            style={{
              padding: "8px 16px",
              background: refreshing ? "#444" : "#4ade80",
              color: refreshing ? "#888" : "#000",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: "bold",
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            {refreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
        <nav style={{ display: "flex", gap: "15px" }}>
          <Link to="/" style={{ color: "#888", textDecoration: "none" }}>Home</Link>
          <Link to="/arena" style={{ color: "#888", textDecoration: "none" }}>Arena</Link>
          <Link to="/leaderboard" style={{ color: "#888", textDecoration: "none" }}>Leaderboard</Link>
          <Link to="/how-it-works" style={{ color: "#888", textDecoration: "none" }}>How It Works</Link>
        </nav>
      </header>

      <main>
        {loading && <p>Loading entries...</p>}
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
        
        {!loading && !error && entries.length === 0 && (
          <div style={{ 
            background: "#1a1a1a", 
            padding: "40px", 
            borderRadius: "8px", 
            textAlign: "center" 
          }}>
            <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
              No entries yet
            </p>
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

        {!loading && !error && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {entries.map((entry) => (
              <div 
                key={entry.id}
                style={{ 
                  background: "#1a1a1a", 
                  padding: "20px", 
                  borderRadius: "8px",
                  border: "1px solid #333"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  marginBottom: "15px",
                  paddingBottom: "15px",
                  borderBottom: "1px solid #333"
                }}>
                  <div>
                    <h3 style={{ fontSize: "1.3rem", marginBottom: "5px" }}>
                      {entry.pool_name}
                    </h3>
                    <p style={{ color: "#888", fontSize: "0.9rem" }}>
                      Submitted: {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>
                      Total Score
                    </div>
                    <div style={{ 
                      fontSize: "2rem", 
                      fontWeight: "bold",
                      color: "#4ade80"
                    }}>
                      {entry.total_score.toFixed(1)}
                    </div>
                    {entry.hot_streak_bonus_total > 0 && (
                      <div style={{ fontSize: "0.8rem", color: "#ff6600" }}>
                        🔥 +{entry.hot_streak_bonus_total.toFixed(1)} bonus
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                  gap: "10px",
                  marginBottom: "15px"
                }}>
                  <div style={{ 
                    background: "#222", 
                    padding: "12px", 
                    borderRadius: "6px" 
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>
                      Base Points
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                      {entry.points_total.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ 
                    background: "#222", 
                    padding: "12px", 
                    borderRadius: "6px" 
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>
                      Total Cost
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                      {entry.total_cost}/10
                    </div>
                  </div>
                  <div style={{ 
                    background: "#222", 
                    padding: "12px", 
                    borderRadius: "6px" 
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>
                      Last Updated
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                      {new Date(entry.updated_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "1rem", marginBottom: "10px", color: "#888" }}>
                    Your Lineup:
                  </h4>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", 
                    gap: "10px" 
                  }}>
                    {entry.players.map((player, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          background: "#222", 
                          padding: "10px", 
                          borderRadius: "6px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                            {player.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>
                            {player.position} • {player.team}
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: "0.9rem", 
                          color: "#4ade80",
                          fontWeight: "bold"
                        }}>
                          ${player.price}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
