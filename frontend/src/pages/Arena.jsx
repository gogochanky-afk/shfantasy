import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Arena() {
  const [pools, setPools] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/pools")
      .then((res) => {
        if (!res.ok) throw new Error("API not ready");
        return res.json();
      })
      .then((data) => {
        setPools(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">🏀 Arena</h1>
        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/my-entries" className="nav-link">My Entries</Link>
          <Link to="/how-it-works" className="nav-link">How It Works</Link>
        </nav>
      </header>

      <main className="content">
        {loading && <p>Loading pools...</p>}
        {error && (
          <div className="error-box">
            <p>⚠️ API not ready</p>
            <p className="error-detail">{error}</p>
          </div>
        )}
        {pools && (
          <div className="pools-list">
            <h2>Available Pools</h2>
            <pre>{JSON.stringify(pools, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
