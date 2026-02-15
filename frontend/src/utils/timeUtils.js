/**
 * Get remaining seconds for a pool
 * Priority: 
 * 1. Use pool.lock_in (number of seconds) if available (DEMO mode)
 * 2. Otherwise calculate from pool.lock_time (ISO string)
 * 
 * @param {Object} pool - Pool object with lock_time or lock_in
 * @returns {number} Remaining seconds (0 if locked, never negative)
 */
export function getRemainingSeconds(pool) {
  if (!pool) return 0;

  // Priority 1: Use lock_in if it's a valid number
  if (typeof pool.lock_in === 'number' && !isNaN(pool.lock_in)) {
    return Math.max(0, pool.lock_in);
  }

  // Priority 2: Calculate from lock_time
  if (pool.lock_time) {
    try {
      const lockTime = new Date(pool.lock_time);
      
      // Check if date is valid
      if (isNaN(lockTime.getTime())) {
        console.warn('[timeUtils] Invalid lock_time:', pool.lock_time);
        return 0;
      }

      const now = new Date();
      const diffMs = lockTime - now;
      const diffSeconds = Math.floor(diffMs / 1000);
      
      return Math.max(0, diffSeconds);
    } catch (error) {
      console.error('[timeUtils] Error parsing lock_time:', error);
      return 0;
    }
  }

  // No valid time data
  return 0;
}

/**
 * Format remaining seconds to display string
 * @param {number} seconds - Remaining seconds
 * @returns {string} Formatted time string (e.g., "5:30" or "--:--")
 */
export function formatRemainingTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '--:--';
  }

  if (seconds === 0) {
    return 'LOCKED';
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format remaining time with units (e.g., "5m 30s")
 * @param {number} seconds - Remaining seconds
 * @returns {string} Formatted time string with units
 */
export function formatRemainingTimeWithUnits(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '--:--';
  }

  if (seconds === 0) {
    return 'LOCKED';
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}
