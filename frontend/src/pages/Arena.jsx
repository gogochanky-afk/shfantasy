import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Arena() {
  const navigate = useNavigate();
  const [pools, setPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [roster, setRoster] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dataMode, setDataMode] = useState("unknown");
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

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

  // Countdown timer
  const [lockingSoon, setLockingSoon] = useState(false);

  useEffect(() => {
    if (!selectedPool) return;

    const updateTimer = () => {
      const now = new Date();
      const lockTime = new Date(selectedPool.lock_time);
      const diff = lockTime - now;

      if (diff <= 0) {
        setIsLocked(true);
        setTimeRemaining("LOCKED");
        setLockingSoon(false);
      } else {
        setIsLocked(false);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}m ${seconds}s`);
        
        // "Locking soon" when <= 2 minutes
        setLockingSoon(diff <= 2 * 60 * 1000);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedPool]);

  // Fetch roster when pool changes
  useEffect(() => {
    if (!selectedPool) return;

    setRoster(null);
    setSelectedPlayers([]);

    fetch(`/api/roster?pool_id=${selectedPool.pool_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setRoster(data);
        } else {
          setError("Failed to load roster");
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [selectedPool]);

  const togglePlayer = (player) => {
    if (isLocked) return; // Disable selection when locked

    if (selectedPlayers.find((p) => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
    } else {
      if (selectedPlayers.length < 5) {
        setSelectedPlayers([...selectedPlayers, player]);
      }
    }
  };

  const totalCost = selectedPlayers.reduce((sum, p) => sum + p.price, 0);
  const isValid = selectedPlayers.length === 5 && totalCost <= 10 && !isLocked;

  const handleSubmit = async () => {
    if (!isValid) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pool_id: selectedPool.pool_id,
          player_ids: selectedPlayers.map((p) => p.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Error: ${data.error}`);
        setSubmitting(false);
        return;
      }

      alert("Entry submitted successfully!");
      navigate("/my-entries");
    } catch (err) {
      alert(`Failed to submit: ${err.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #0a0a0f 0%, #12131a 100%)", 
      color: "#fff", 
      padding: "80px 20px 20px" // Top padding for global countdown bar
    }}>
      <header style={{ 
        marginBottom: "30px", 
        borderBottom: "1px solid #333", 
        paddingBottom: "15px" 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>🏀 Arena</h1>
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
          <Link to="/my-entries" style={{ color: "#888", textDecoration: "none" }}>My Entries</Link>
          <Link to="/how-it-works" style={{ color: "#888", textDecoration: "none" }}>How It Works</Link>
        </nav>
      </header>

      <main style={{
        maxWidth: "1200px",
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(0, 255, 255, 0.2)",
        borderRadius: "16px",
        padding: "30px",
        boxShadow: "0 0 40px rgba(0, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)",
      }}>
        {loading && <p>Loading pools...</p>}
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
        
        {selectedPool && roster && (
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

            {/* Pool Info - Glass Card */}
            <div style={{ 
              background: "rgba(255, 255, 255, 0.03)", 
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(0, 255, 255, 0.15)",
              padding: "24px", 
              borderRadius: "12px", 
              marginBottom: "30px",
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.1)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h2 style={{ fontSize: "1.5rem" }}>
                  {selectedPool.home.abbr} vs {selectedPool.away.abbr}
                </h2>
                {isLocked ? (
                  <div style={{ 
                    background: "rgba(255, 68, 68, 0.2)",
                    border: "1px solid #ff4444",
                    color: "#ff4444",
                    padding: "8px 18px", 
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    boxShadow: "0 0 15px rgba(255, 68, 68, 0.3)"
                  }}>
                    🔒 LOCKED
                  </div>
                ) : (
                  <div style={{ 
                    background: lockingSoon ? "rgba(255, 152, 0, 0.2)" : "rgba(74, 222, 128, 0.2)",
                    border: lockingSoon ? "1px solid #ff9800" : "1px solid #4ade80",
                    color: lockingSoon ? "#ff9800" : "#4ade80",
                    padding: "8px 18px", 
                    borderRadius: "8px",
                    fontSize: "0.95rem",
                    fontWeight: "bold",
                    boxShadow: lockingSoon ? "0 0 15px rgba(255, 152, 0, 0.3)" : "0 0 15px rgba(74, 222, 128, 0.3)"
                  }}>
                    {lockingSoon ? "⚠️ Locking soon" : "⏱️"} {timeRemaining}
                  </div>
                )}
              </div>
              <div style={{ 
                display: "flex", 
                gap: "20px", 
                color: "#888", 
                fontSize: "0.9rem",
                marginTop: "15px"
              }}>
                <span>Lock Time: {new Date(selectedPool.lock_time).toLocaleString()}</span>
              </div>
              <div style={{ 
                marginTop: "20px", 
                padding: "15px", 
                background: "rgba(0, 255, 255, 0.05)",
                border: "1px solid rgba(0, 255, 255, 0.2)",
                borderRadius: "8px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "5px" }}>Prize Pool</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#00ffff" }}>$1,000</div>
              </div>
            </div>

            {/* Selection Summary */}
            <div style={{ 
              background: "#1a1a1a", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "30px" 
            }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "15px" }}>
                Your Lineup
              </h3>
              <div style={{ marginBottom: "15px" }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  marginBottom: "10px" 
                }}>
                  <span>Players: {selectedPlayers.length}/5</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "2px" }}>
                      Remaining Credits
                    </div>
                    <div style={{ 
                      fontSize: "2rem", 
                      fontWeight: "bold",
                      color: totalCost > 10 ? "#ff4444" : "#4ade80" 
                    }}>
                      {10 - totalCost}
                    </div>
                  </div>
                </div>
                <div style={{ 
                  height: "8px", 
                  background: "#333", 
                  borderRadius: "4px", 
                  overflow: "hidden" 
                }}>
                  <div style={{ 
                    height: "100%", 
                    width: `${(totalCost / 10) * 100}%`, 
                    background: totalCost > 10 ? "#ff4444" : "#4ade80",
                    transition: "width 0.3s" 
                  }} />
                </div>
              </div>

              {selectedPlayers.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  {selectedPlayers.map((p) => (
                    <div 
                      key={p.id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        padding: "8px 0", 
                        borderBottom: "1px solid #333" 
                      }}
                    >
                      <span>{p.name} ({p.team})</span>
                      <span>${p.price}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: isValid && !submitting ? "#4ade80" : "#333",
                  color: isValid && !submitting ? "#000" : "#666",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: isValid && !submitting ? "pointer" : "not-allowed",
                }}
              >
                {submitting ? "Submitting..." : isLocked ? "Pool Locked" : "Submit Entry"}
              </button>

              {!isValid && selectedPlayers.length > 0 && (
                <p style={{ 
                  color: "#ff4444", 
                  marginTop: "10px", 
                  fontSize: "0.9rem" 
                }}>
                  {isLocked && "Pool is locked. "}
                  {!isLocked && selectedPlayers.length !== 5 && "Select exactly 5 players. "}
                  {!isLocked && totalCost > 10 && "Total cost exceeds salary cap."}
                </p>
              )}
              
              {isLocked && selectedPlayers.length === 0 && (
                <p style={{ 
                  color: "#ff4444", 
                  marginTop: "10px", 
                  fontSize: "0.9rem" 
                }}>
                  🔒 This pool is locked. No new entries allowed.
                </p>
              )}
            </div>

            {/* Available Players */}
            <div>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "15px" }}>
                Available Players ({roster.mode})
              </h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", 
                gap: "15px" 
              }}>
                {roster.players.map((player) => {
                  const isSelected = selectedPlayers.find((p) => p.id === player.id);
                  return (
                    <div
                      key={player.id}
                      onClick={() => togglePlayer(player)}
                      style={{
                        background: isSelected ? "#2a4a2a" : "#1a1a1a",
                        border: isSelected ? "2px solid #4ade80" : "1px solid #333",
                        padding: "15px",
                        borderRadius: "8px",
                        cursor: isLocked ? "not-allowed" : "pointer",
                        opacity: isLocked ? 0.5 : 1,
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        marginBottom: "8px" 
                      }}>
                        <span style={{ fontWeight: "bold" }}>{player.name}</span>
                        <span style={{ 
                          background: "#333", 
                          padding: "2px 8px", 
                          borderRadius: "4px", 
                          fontSize: "0.9rem" 
                        }}>
                          ${player.price}
                        </span>
                      </div>
                      <div style={{ color: "#888", fontSize: "0.9rem" }}>
                        {player.team} • {player.position}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
