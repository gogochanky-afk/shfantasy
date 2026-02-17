import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Arena() {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [salaryUsed, setSalaryUsed] = useState(0);
  const salaryCap = 10;
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/roster")
      .then(res => res.json())
      .then(data => setPlayers(data.players || []));
  }, []);

  function togglePlayer(p) {
    let updated;

    if (selected.find(x => x.playerId === p.playerId)) {
      updated = selected.filter(x => x.playerId !== p.playerId);
    } else {
      if (selected.length >= 5) return;
      updated = [...selected, p];
    }

    const total = updated.reduce((sum, x) => sum + x.salary, 0);
    if (total > salaryCap) return;

    setSelected(updated);
    setSalaryUsed(total);
  }

  function submit() {
    fetch("/api/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        players: selected,
        totalSalary: salaryUsed
      })
    }).then(() => navigate("/leaderboard"));
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Pick 5 Players</h2>
      <div>Salary: {salaryUsed} / {salaryCap}</div>

      {players.map(p => (
        <div key={p.playerId} style={{ marginBottom: 8 }}>
          <button onClick={() => togglePlayer(p)}>
            {p.name} (${p.salary})
          </button>
        </div>
      ))}

      <br />
      <button onClick={submit}>Submit</button>
    </div>
  );
}
