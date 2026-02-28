// lib/cache.js
// Simple in-memory TTL cache.
// Supports stale-on-error: if a fetch fails (e.g. 429), the last
// successful value is returned instead of falling back to DEMO data.
//
// Usage:
//   const { getOrFetch } = require("./cache");
//   const data = await getOrFetch("pools:live", 120, async () => {
//     return await fetchFromSportradar();
//   });

"use strict";

const store = new Map(); // key → { value, fetchedAt, ttl }

/**
 * Get a cached value or call fetcher() to refresh it.
 *
 * @param {string}   key       - Cache key
 * @param {number}   ttl       - Time-to-live in seconds
 * @param {Function} fetcher   - Async function that returns fresh data.
 *                               May throw; on throw the stale value is returned
 *                               if available (stale-on-error behaviour).
 * @returns {Promise<{value: any, stale: boolean, cachedAt: string|null}>}
 */
async function getOrFetch(key, ttl, fetcher) {
  const now = Date.now();
  const entry = store.get(key);

  // Cache hit and still fresh → return immediately
  if (entry && now - entry.fetchedAt < ttl * 1000) {
    return { value: entry.value, stale: false, cachedAt: new Date(entry.fetchedAt).toISOString() };
  }

  // Cache miss or expired → try to refresh
  try {
    const fresh = await fetcher();
    store.set(key, { value: fresh, fetchedAt: now, ttl });
    return { value: fresh, stale: false, cachedAt: new Date(now).toISOString() };
  } catch (err) {
    // If we have a stale value, serve it (stale-on-error)
    if (entry) {
      const ageS = Math.round((now - entry.fetchedAt) / 1000);
      console.warn(
        `[cache] fetch failed for key="${key}" (${err.message}); ` +
        `serving stale value (age ${ageS}s)`
      );
      return { value: entry.value, stale: true, cachedAt: new Date(entry.fetchedAt).toISOString() };
    }
    // No stale value available — re-throw so caller can handle
    throw err;
  }
}

/**
 * Manually invalidate a cache key (e.g. after a forced refresh).
 */
function invalidate(key) {
  store.delete(key);
}

/**
 * Peek at a cached entry without triggering a fetch.
 * Returns null if not cached.
 */
function peek(key) {
  return store.get(key) || null;
}

module.exports = { getOrFetch, invalidate, peek };
