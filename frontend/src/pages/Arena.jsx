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

    if (selected.find(x => x.playerId === p.playerId)) {
      updated = selected.filter(x => x.playerId !== p.playerId);
    } else {
      if (selected.length >= 5) return;
      updated = [...selected, p];
    }

    const total = updated.reduce((sum, x) => sum + x.price, 0);
    if (total > salaryCap) return;

    setSelected(updated);
    setSalaryUsed(total);
  }

  async function submitEntry() {
    if (selected.length !== 5) return;

    const res = await fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolId: id,
        players: selected,
        totalSalary: salaryUsed
      })
    });

    const data = await res.json();
    alert("Score: " + data.score);
    navigate("/leaderboard?pool=" + id);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Arena</h2>

      <div>
        Salary: {salaryUsed} / {salaryCap}
      </div>

      <h3>Selected ({selected.length}/5)</h3>
      {selected.map(p => (
        <div key={p.playerId}>{p.fullName}</div>
      ))}

      <h3>All Players</h3>
      {players.map(p => (
        <div key={p.playerId}>
          {p.fullName} (${p.price})
          <button onClick={() => togglePlayer(p)}>
            {selected.find(x => x.playerId === p.playerId)
              ? "Remove"
              : "Add"}
          </button>
        </div>
      ))}

      <button
        onClick={submitEntry}
        disabled={selected.length !== 5}
        style={{ marginTop: 20 }}
      >
        Submit Entry
      </button>
    </div>
  );
}
