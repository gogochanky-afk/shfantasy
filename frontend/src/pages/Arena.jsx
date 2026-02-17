import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function Arena() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [salaryUsed, setSalaryUsed] = useState(0);

  const salaryCap = 10;

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/roster");
      const data = await res.json();
      setPlayers(data.players || []);
    }
    load();
  }, []);

  function togglePlayer(p) {
    let updated;

    if (selected.find((x) => x.playerId === p.playerId)) {
      updated = selected.filter((x) => x.playerId !== p.playerId);
    } else {
      if (selected.length >= 5) return;
      updated = [...selected, p];
    }

    const total = updated.reduce((sum, x) => sum + x.salary, 0);
    if (total > salaryCap) return;

    setSelected(updated);
    setSalaryUsed(total);
  }

  async function submitEntry() {
    await fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolId: id,
        players: selected,
        totalSalary: salaryUsed,
      }),
    });

    navigate(`/leaderboard?poolId=${id}`);
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>🏀 Arena</h1>

      <div style={{ marginBottom: 20 }}>
        Selected: {selected.length}/5 | Salary: {salaryUsed}/{salaryCap}
      </div>

      <div>
        {players.map((p) => {
          const isSelected = selected.find(
            (x) => x.playerId === p.playerId
          );

          return (
            <div
              key={p.playerId}
              onClick={() => togglePlayer(p)}
              style={{
                padding: 12,
                marginBottom: 8,
                borderRadius: 8,
                cursor: "pointer",
                background: isSelected ? "orange" : "#eee",
              }}
            >
              {p.name} – {p.salary}
            </div>
          );
        })}
      </div>

      {selected.length === 5 && (
        <button
          onClick={submitEntry}
          style={{
            marginTop: 20,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "green",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Submit Lineup 🚀
        </button>
      )}
    </div>
  );
}
