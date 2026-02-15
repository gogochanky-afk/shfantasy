import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Pages
import Arena from './pages/Arena';
import MyEntries from './pages/MyEntries';
import HowItWorks from './pages/HowItWorks';
import Leaderboard from './pages/Leaderboard';

// Components
import GlobalCountdownBar from './components/GlobalCountdownBar';

function HomePage() {
  const [healthStatus, setHealthStatus] = useState({ loading: true, ok: false, data: null });
  const [nextPool, setNextPool] = useState(null);
  const [countdown, setCountdown] = useState(null);

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

  // Fetch next pool
  useEffect(() => {
    const fetchPools = async () => {
      try {
        const response = await fetch('/api/pools');
        const data = await response.json();
        if (data.ok && data.pools.length > 0) {
          // Find first OPEN pool
          const openPool = data.pools.find((p) => p.status === 'OPEN');
          setNextPool(openPool || data.pools[0]);
        }
      } catch (error) {
        console.error('Error fetching pools:', error);
      }
    };

    fetchPools();
    const interval = setInterval(fetchPools, 30000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!nextPool) return;

    const updateCountdown = () => {
      const now = new Date();
      const lockTime = new Date(nextPool.lock_time);
      const diff = lockTime - now;

      if (diff <= 0) {
        setCountdown('LOCKED');
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextPool]);

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
          {nextPool && (
            <div className="next-pool" style={{ marginTop: '20px', padding: '15px', background: '#1a1a1a', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '5px' }}>Next Pool:</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>
                {nextPool.home.abbr} vs {nextPool.away.abbr}
              </div>
              <div style={{ fontSize: '1rem', color: countdown === 'LOCKED' ? '#ff4444' : '#4ade80' }}>
                {countdown === 'LOCKED' ? '🔒 LOCKED' : `⏱️ Locks in ${countdown}`}
              </div>
            </div>
          )}
        </div>

        <div className="actions">
          <Link to="/arena" className="btn btn-primary">
            ⚡ Enter Arena
          </Link>
          <Link to="/leaderboard" className="btn btn-secondary">
            🏆 Leaderboard
          </Link>
          <Link to="/my-entries" className="btn btn-secondary">
            📋 My Entries
          </Link>
          <Link to="/how-it-works" className="btn btn-secondary">
            📖 How It Works
          </Link>
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

export default function App() {
  return (
    <BrowserRouter>
      <GlobalCountdownBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </BrowserRouter>
  );
}
