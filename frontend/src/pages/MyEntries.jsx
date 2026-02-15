import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function MyEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((res) => {
        if (!res.ok) throw new Error("API not ready");
        return res.json();
      })
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
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
        <h1 style={{ 
          fontSize: "2rem", 
          fontWeight: "bold", 
          marginBottom: "10px" 
        }}>
          📋 My Entries
        </h1>
        <nav style={{ display: "flex", gap: "15px" }}>
          <Link to="/" style={{ color: "#888", textDecoration: "none" }}>Home</Link>
          <Link to="/arena" style={{ color: "#888", textDecoration: "none" }}>Arena</Link>
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
            <p>⚠️ API not ready</p>
            <p style={{ color: "#ff4444" }}>{error}</p>
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
                padding: "12px 24px",
                background: "#4ade80",
                color: "#000",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: "bold"
              }}
            >
              Enter a Pool
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
                {/* Entry Header */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  marginBottom: "15px",
                  paddingBottom: "15px",
                  borderBottom: "1px solid #333"
                }}>
                  <div>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: "5px" }}>
                      {entry.pool_name}
                    </h3>
                    <p style={{ color: "#888", fontSize: "0.9rem" }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ 
                      background: "#2a4a2a", 
                      color: "#4ade80", 
                      padding: "4px 12px", 
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      marginBottom: "5px"
                    }}>
                      {entry.status}
                    </div>
                    <p style={{ color: "#888", fontSize: "0.9rem" }}>
                      Score: {entry.score}
                    </p>
                  </div>
                </div>

                {/* Players List */}
                <div>
                  <h4 style={{ 
                    fontSize: "1rem", 
                    marginBottom: "10px", 
                    color: "#888" 
                  }}>
                    Lineup (Total Cost: ${entry.total_cost})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {entry.players.map((player) => (
                      <div 
                        key={player.id} 
                        style={{ 
                          display: "flex", 
                          justifyContent: "space-between",
                          padding: "10px",
                          background: "#0f0f0f",
                          borderRadius: "6px"
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: "bold" }}>{player.name}</span>
                          <span style={{ color: "#888", marginLeft: "10px" }}>
                            {player.team} • {player.position}
                          </span>
                        </div>
                        <span style={{ 
                          background: "#333", 
                          padding: "2px 8px", 
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}>
                          ${player.cost}
                        </span>
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
