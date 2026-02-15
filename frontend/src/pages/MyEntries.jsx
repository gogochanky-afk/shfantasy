import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function MyEntries() {
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((res) => {
        if (!res.ok) throw new Error("API not ready");
        return res.json();
      })
      .then((data) => {
        setEntries(data);
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
        <h1 className="title">📋 My Entries</h1>
        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/arena" className="nav-link">Arena</Link>
          <Link to="/how-it-works" className="nav-link">How It Works</Link>
        </nav>
      </header>

      <main className="content">
        {loading && <p>Loading entries...</p>}
        {error && (
          <div className="error-box">
            <p>⚠️ API not ready</p>
            <p className="error-detail">{error}</p>
          </div>
        )}
        {entries && (
          <div className="entries-list">
            <h2>Your Entries</h2>
            <pre>{JSON.stringify(entries, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
