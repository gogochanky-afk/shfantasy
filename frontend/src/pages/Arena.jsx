import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Arena() {
  const navigate = useNavigate();
  const [pools, setPools] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/pools")
      .then((res) => {
        if (!res.ok) throw new Error("API not ready");
        return res.json();
      })
      .then((data) => {
        setPools(data);
        if (data.pools && data.pools.length > 0) {
          setSelectedPool(data.pools[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const togglePlayer = (player) => {
    if (selectedPlayers.find((p) => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter((p) => p.id !== player.id));
    } else {
      if (selectedPlayers.length < 5) {
        setSelectedPlayers([...selectedPlayers, player]);
      }
    }
  };

  const totalCost = selectedPlayers.reduce((sum, p) => sum + p.cost, 0);
  const isValid = selectedPlayers.length === 5 && totalCost <= 10;

  const handleSubmit = async () => {
    if (!isValid) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pool_id: selectedPool.id,
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
          🏀 Arena
        </h1>
        <nav style={{ display: "flex", gap: "15px" }}>
          <Link to="/" style={{ color: "#888", textDecoration: "none" }}>Home</Link>
          <Link to="/my-entries" style={{ color: "#888", textDecoration: "none" }}>My Entries</Link>
          <Link to="/how-it-works" style={{ color: "#888", textDecoration: "none" }}>How It Works</Link>
        </nav>
      </header>

      <main>
        {loading && <p>Loading pools...</p>}
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
        
        {selectedPool && (
          <div>
            {/* Pool Info */}
            <div style={{ 
              background: "#1a1a1a", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "30px" 
            }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>
                {selectedPool.name}
              </h2>
              <div style={{ display: "flex", gap: "20px", color: "#888" }}>
                <span>Entry Fee: ${selectedPool.entry_fee}</span>
                <span>Prize Pool: ${selectedPool.prize_pool}</span>
                <span>Entries: {selectedPool.entries}/{selectedPool.max_entries}</span>
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
                  marginBottom: "5px" 
                }}>
                  <span>Players: {selectedPlayers.length}/5</span>
                  <span style={{ 
                    color: totalCost > 10 ? "#ff4444" : "#4ade80" 
                  }}>
                    Cost: {totalCost}/10
                  </span>
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
                      <span>${p.cost}</span>
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
                {submitting ? "Submitting..." : "Submit Entry"}
              </button>

              {!isValid && selectedPlayers.length > 0 && (
                <p style={{ 
                  color: "#ff4444", 
                  marginTop: "10px", 
                  fontSize: "0.9rem" 
                }}>
                  {selectedPlayers.length !== 5 && "Select exactly 5 players. "}
                  {totalCost > 10 && "Total cost exceeds salary cap."}
                </p>
              )}
            </div>

            {/* Available Players */}
            <div>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "15px" }}>
                Available Players
              </h3>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", 
                gap: "15px" 
              }}>
                {selectedPool.players.map((player) => {
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
                        cursor: "pointer",
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
                          ${player.cost}
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
