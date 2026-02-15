import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState({ loading: true, ok: false, data: null });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealthStatus({ loading: false, ok: response.ok, data });
      } catch (error) {
        setHealthStatus({ loading: false, ok: false, data: { error: error.message } });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">SHFantasy</h1>
        <div className="status">
          {healthStatus.loading ? (
            <span className="status-badge loading">Checking...</span>
          ) : healthStatus.ok ? (
            <span className="status-badge online">● Online</span>
          ) : (
            <span className="status-badge offline">● Offline</span>
          )}
        </div>
      </header>

      <main className="main">
        <div className="hero">
          <h2 className="hero-title">Welcome to SHFantasy</h2>
          <p className="hero-subtitle">
            NBA Daily Fantasy Sports - Pick your lineup, compete for prizes
          </p>
          {healthStatus.data && (
            <div className="data-mode">
              DATA MODE: <strong>{healthStatus.data.data_mode?.toUpperCase() || 'UNKNOWN'}</strong>
            </div>
          )}
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={() => alert('Arena coming soon!')}>
            ⚡ Enter Arena
          </button>
          <button className="btn btn-secondary" onClick={() => alert('My Entries coming soon!')}>
            🏆 My Entries
          </button>
        </div>

        <div className="info-cards">
          <div className="card">
            <div className="card-number">1</div>
            <h3>Choose a Pool</h3>
            <p>Select from today's NBA games</p>
          </div>
          <div className="card">
            <div className="card-number">2</div>
            <h3>Build Your Lineup</h3>
            <p>Pick 5 players within salary cap</p>
          </div>
          <div className="card">
            <div className="card-number">3</div>
            <h3>Win Prizes</h3>
            <p>Top scores share the prize pool</p>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 SHFantasy - Powered by Cloud Run</p>
      </footer>
    </div>
  );
}

export default App;
