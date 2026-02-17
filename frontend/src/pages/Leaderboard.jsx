import { useEffect, useState } from "react";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(res => res.json())
      .then(data => setRows(data.leaderboard || []));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Leaderboard</h2>

      {rows.map((r, i) => (
        <div key={r.id}>
          #{i + 1} — Salary: {r.totalSalary}
        </div>
      ))}
    </div>
  );
}
