import { useState, useEffect } from 'react';
import './App.css';
import { getVersionString } from './utils/version';

const API_BASE = '';

// ============ Helper Functions ============
// Get remaining seconds from pool (prioritize lock_in, fallback to lock_at)
function getRemainingSeconds(pool) {
  if (!pool) return 0;
  
  // Priority 1: Use lock_in if available (DEMO mode)
  if (typeof pool.lock_in === 'number') {
    return Math.max(0, pool.lock_in);
  }
  
  // Priority 2: Calculate from lock_at if valid ISO string
  if (pool.lock_at) {
    const lockTime = new Date(pool.lock_at);
    if (!isNaN(lockTime.getTime())) {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((lockTime.getTime() - now) / 1000));
      return remaining;
    }
  }
  
  return 0;
}

// Format seconds to mm:ss
function formatMMSS(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============ Home Page ============
function HomePage() {
  const [pools, setPools] = useState([]);
  const [cycleRemaining, setCycleRemaining] = useState(null);
  const [dataMode, setDataMode] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPools();
    const interval = setInterval(fetchPools, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cycleRemaining === null) return;
    const interval = setInterval(() => {
      setCycleRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cycleRemaining]);

  const fetchPools = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pools`);
      const data = await res.json();
      if (data.ok) {
        setPools(data.pools || []);
        setDataMode(data.data_mode || 'demo');
        // Calculate cycle_remaining_s from first OPEN pool
        const openPool = data.pools.find((p) => p.status === 'OPEN');
        if (openPool) {
          setCycleRemaining(getRemainingSeconds(openPool));
        }
      } else {
        setError('Failed to fetch pools');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    return formatMMSS(seconds);
  };

  const isWarning = cycleRemaining !== null && cycleRemaining <= 30;

  return (
    <div className="page">
      {/* Sticky Countdown Bar */}
      <div className={`sticky-bar ${isWarning ? 'warning' : ''}`}>
        <div className="sticky-content">
          <span>🔥 Next Game Starts In: {formatTime(cycleRemaining)}</span>
          <span className="data-mode">DATA: {dataMode.toUpperCase()}</span>
        </div>
      </div>

      <div className="container">
        <h1 className="title">SHFantasy Alpha</h1>
        <p className="subtitle">Pick 5 Players. Stay Under $10. Win Big.</p>

        {error && (
          <div className="error-box">
            {error} - <button onClick={fetchPools}>Retry</button>
          </div>
        )}

        <div className="pool-grid">
          {pools.length === 0 && !error && <p>Loading pools...</p>}
          {pools.map((pool) => (
            <PoolCard key={pool.pool_id} pool={pool} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PoolCard({ pool }) {
  const [remaining, setRemaining] = useState(getRemainingSeconds(pool));

  useEffect(() => {
    // Reset countdown when pool changes
    setRemaining(getRemainingSeconds(pool));
    
    // Update countdown every second
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [pool]);

  const handleClick = () => {
    window.location.hash = `#/pool/${pool.pool_id}`;
  };

  const isLocked = pool.status === 'LOCKED' || pool.status === 'CLOSED';

  return (
    <div className={`pool-card ${isLocked ? 'locked' : ''}`} onClick={!isLocked ? handleClick : null}>
      <div className="pool-header">
        <span className={`status-badge ${pool.status.toLowerCase()}`}>{pool.status}</span>
      </div>
      <div className="pool-matchup">
        <span>{pool.home?.abbr || 'HOME'}</span>
        <span className="vs">vs</span>
        <span>{pool.away?.abbr || 'AWAY'}</span>
      </div>
      <div className="pool-info">
        <div>Locks in: {formatMMSS(remaining)}</div>
      </div>
      {!isLocked && <button className="btn-primary">Enter Pool</button>}
      {isLocked && <div className="locked-text">🔒 Locked</div>}
    </div>
  );
}

// ============ Pool Page ============
function PoolPage({ poolId }) {
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState([]);
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRoster();
  }, [poolId]);

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/roster?pool_id=${poolId}`);
      const data = await res.json();
      if (data.ok) {
        setRoster(data.players || []);
        setPool({ pool_id: data.pool_id, mode: data.mode });
      } else {
        setError('Failed to fetch roster');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayer = (player) => {
    if (selected.find((p) => p.id === player.id)) {
      setSelected(selected.filter((p) => p.id !== player.id));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, player]);
      }
    }
  };

  const totalCost = selected.reduce((sum, p) => sum + p.price, 0);
  const canSubmit = selected.length === 5 && totalCost <= 10;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/entries?user_id=demo_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool_id: poolId,
          lineup: selected.map((p) => ({ player_id: p.id })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
      } else {
        alert(`Error: ${data.error || 'Submission failed'}`);
      }
    } catch (err) {
      alert('Network error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><div className="container">Loading roster...</div></div>;
  if (error) return <div className="page"><div className="container"><div className="error-box">{error}</div></div></div>;
  if (success) {
    return (
      <div className="page">
        <div className="container">
          <div className="success-box">
            <h2>✅ Entry Submitted!</h2>
            <p>Your lineup has been saved.</p>
            <button className="btn-primary" onClick={() => (window.location.hash = '#/myentries')}>
              View My Entries
            </button>
            <button className="btn-secondary" onClick={() => (window.location.hash = '#/')}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <button className="btn-back" onClick={() => (window.location.hash = '#/')}>
          ← Back
        </button>
        <h1 className="title">Select Your Lineup</h1>
        <div className="cap-bar">
          <span>Selected: {selected.length}/5</span>
          <span className={totalCost > 10 ? 'cap-exceeded' : ''}>
            Cost: ${totalCost}/10
          </span>
        </div>
        {totalCost > 10 && <div className="warning-text">⚠️ Cap exceeded! Remove players.</div>}

        <div className="roster-grid">
          {roster.map((player) => {
            const isSelected = selected.find((p) => p.id === player.id);
            return (
              <div
                key={player.id}
                className={`player-card ${isSelected ? 'selected' : ''}`}
                onClick={() => togglePlayer(player)}
              >
                <div className="player-header">
                  <span className="player-name">{player.name}</span>
                  <span className="player-price">${player.price}</span>
                </div>
                <div className="player-info">
                  <span className="player-team">{player.team}</span>
                  <span className="player-pos">{player.position}</span>
                </div>
                {player.injury_status && <div className="injury-tag">{player.injury_status}</div>}
              </div>
            );
          })}
        </div>

        <button
          className="btn-submit"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Submitting...' : canSubmit ? 'Submit Lineup' : 'Select 5 Players'}
        </button>
      </div>
    </div>
  );
}

// ============ My Entries Page ============
function MyEntriesPage() {
  const [tab, setTab] = useState('entries'); // 'entries' or 'leaderboard'
  const [entries, setEntries] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPools();
  }, []);

  useEffect(() => {
    if (tab === 'entries') {
      fetchEntries();
    } else if (tab === 'leaderboard' && selectedPool) {
      fetchLeaderboard(selectedPool);
    }
  }, [tab, selectedPool]);

  const fetchPools = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pools`);
      const data = await res.json();
      if (data.ok && data.pools.length > 0) {
        setPools(data.pools);
        setSelectedPool(data.pools[0].pool_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/entries?user_id=demo_user`);
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (poolId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/leaderboard?pool_id=${poolId}`);
      const data = await res.json();
      if (data.ok) {
        setLeaderboard(data.rows || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <button className="btn-back" onClick={() => (window.location.hash = '#/')}>
          ← Back
        </button>
        <h1 className="title">My Dashboard</h1>

        <div className="tabs">
          <button className={tab === 'entries' ? 'tab active' : 'tab'} onClick={() => setTab('entries')}>
            My Entries
          </button>
          <button className={tab === 'leaderboard' ? 'tab active' : 'tab'} onClick={() => setTab('leaderboard')}>
            Leaderboard
          </button>
        </div>

        {tab === 'entries' && (
          <div>
            {loading && <p>Loading...</p>}
            {!loading && entries.length === 0 && <p>No entries yet. Go enter a pool!</p>}
            {!loading && entries.map((entry) => (
              <div key={entry.entry_id} className="entry-card">
                <div className="entry-header">
                  <span>Entry #{entry.entry_id.slice(-8)}</span>
                  <span>${entry.total_cost}</span>
                </div>
                <div className="entry-info">
                  <div>Pool: {entry.pool_id}</div>
                  <div>Players: {entry.player_ids?.length || 0}</div>
                  <div className="entry-time">{new Date(entry.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'leaderboard' && (
          <div>
            {pools.length > 0 && (
              <select
                className="pool-select"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              >
                {pools.map((pool) => (
                  <option key={pool.pool_id} value={pool.pool_id}>
                    {pool.home?.abbr} vs {pool.away?.abbr} ({pool.status})
                  </option>
                ))}
              </select>
            )}
            {loading && <p>Loading...</p>}
            {!loading && leaderboard.length === 0 && <p>No entries yet for this pool.</p>}
            {!loading && leaderboard.map((row, idx) => (
              <div key={row.entry_id} className="leaderboard-row">
                <span className="rank">#{idx + 1}</span>
                <span className="username">{row.username}</span>
                <span className="score">{row.projected_score.toFixed(1)} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main App ============
function App() {
  const [route, setRoute] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderPage = () => {
    if (route === '#/' || route === '') return <HomePage />;
    if (route.startsWith('#/pool/')) {
      const poolId = route.split('/')[2];
      return <PoolPage poolId={poolId} />;
    }
    if (route === '#/myentries') return <MyEntriesPage />;
    return <HomePage />;
  };

  return (
    <div className="app">
      {renderPage()}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        padding: '8px 12px',
        fontSize: '0.75rem',
        color: '#666',
        background: 'rgba(0, 0, 0, 0.5)',
        borderTopLeftRadius: '8px',
        zIndex: 999
      }}>
        {getVersionString()}
      </footer>
    </div>
  );
}

export default App;
