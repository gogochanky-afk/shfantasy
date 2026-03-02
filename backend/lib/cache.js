"use strict";

/**
 * Simple in-memory cache — 120s TTL for Sportradar stubs
 */
const CACHE_TTL = 120 * 1000;
let cache = {};

function get(key) {
  const item = cache[key];
  if (!item) return null;
  if (Date.now() > item.expireAt) {
    delete cache[key];
    return null;
  }
  return item.value;
}

function set(key, value) {
  cache[key] = {
    value,
    expireAt: Date.now() + CACHE_TTL,
  };
}

module.exports = { get, set };
