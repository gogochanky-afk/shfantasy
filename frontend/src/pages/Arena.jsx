import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function Arena() {
  const { id } = useParams();

  const [pool, setPool] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [salaryUsed, setSalaryUsed] = useState(0);

  useEffect(() => {
    async function load() {
      const poolRes = await fetch(`/api/pool/${id}`);
      const poolData = await poolRes.json();
      setPool(poolData.pool);

      const rosterRes = await fetch("/api/players");
      const rosterData = await rosterRes.json();
      setPlayers(rosterData.players || []);
    }
    load();
  }, [id]);

  function togglePlayer(player) {
    let updated;

    if (selected.find(p => p.playerId === player.playerId)) {
      updated = selected.filter(p => p.playerId !== player.playerId);
    } else {
      if (selected.length >= (pool?.rosterSize || 5)) return;
      updated = [...selected, player];
    }

    const totalSalary = updated.reduce((sum, p) => sum + p.price, 0);

    if (totalSalary > (pool?.salaryCap || 10)) return;

    setSelected(updated);
    setSalaryUsed(totalSalary);
  }

  if (!pool) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{pool.name}</h2>

      <div style={{ marginBottom: 20 }}>
        Selected: {selected.length}/{pool.rosterSize}
        <br />
        Salary Used: {salaryUsed}/{pool.salaryCap}
      </div>

      {players.map(player => (
        <div
          key={player.playerId}
          style={{
            border: "1px solid #333",
            padding: 8,
            marginBottom: 8,
            cursor: "pointer",
            background:
              selected.find(p => p.playerId === player.playerId)
                ? "#222"
                : "transparent"
          }}
          onClick={() => togglePlayer(player)}
        >
          {player.fullName} — ${player.price}
        </div>
      ))}

      <button
        disabled={
          selected.length !== pool.rosterSize ||
          salaryUsed > pool.salaryCap
        }
        style={{ marginTop: 20 }}
      >
        Submit Lineup
      </button>
    </div>
  );
}
