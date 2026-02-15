import { useState, useEffect } from 'react';
import { getRemainingSeconds, formatRemainingTime } from '../utils/timeUtils';

export default function GlobalCountdownBar() {
  const [pool, setPool] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isUrgent, setIsUrgent] = useState(false);

  // Fetch next OPEN pool
  useEffect(() => {
    const fetchPool = async () => {
      try {
        const response = await fetch('/api/pools');
        const data = await response.json();
        if (data.ok && data.pools.length > 0) {
          const openPool = data.pools.find((p) => p.status === 'OPEN');
          setPool(openPool || null);
        }
      } catch (error) {
        console.error('Error fetching pools:', error);
      }
    };

    fetchPool();
    const interval = setInterval(fetchPool, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!pool) return;

    const updateCountdown = () => {
      const remainingSeconds = getRemainingSeconds(pool);
      const formatted = formatRemainingTime(remainingSeconds);
      
      setCountdown(formatted);
      setIsUrgent(remainingSeconds > 0 && remainingSeconds <= 30);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pool]);

  if (!pool || countdown === 'LOCKED') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'linear-gradient(135deg, #0e0f14 0%, #12131a 100%)',
        borderBottom: '2px solid rgba(0, 255, 255, 0.6)',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
        padding: '12px 20px',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
        animation: isUrgent ? 'shake 0.5s infinite, pulse 1s infinite' : 'none',
      }}
    >
      <div
        style={{
          fontSize: '1rem',
          fontWeight: '700',
          letterSpacing: '1px',
          color: isUrgent ? '#ff4444' : '#00ffff',
          textShadow: isUrgent
            ? '0 0 10px rgba(255, 68, 68, 0.8)'
            : '0 0 10px rgba(0, 255, 255, 0.8)',
          transition: 'color 0.3s, text-shadow 0.3s',
        }}
      >
        🔥 BLITZ ARENA — LOCK IN{' '}
        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{countdown}</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
