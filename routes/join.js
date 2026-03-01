'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { saveEntry, getEntriesByUser } = require('../lib/entryStore');

// POST /api/join
router.post('/', async (req, res) => {
  try {
    const { poolId, userId, username } = req.body || {};
    if (!poolId || !userId) {
      return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    }

    const entryId = 'e_' + crypto.randomUUID();
    const entry = {
      entryId,
      poolId,
      userId,
      username: username || 'Guest',
      picks: [],
      createdAt: new Date().toISOString(),
      status: 'OPEN',
    };

    await saveEntry(entry);

    return res.json({ ok: true, entryId, poolId, userId });
  } catch (err) {
    console.error('JOIN_ERROR', err);
    return res.status(500).json({ ok: false, error: 'JOIN_FAILED' });
  }
});

// GET /api/join?userId=xxx
router.get('/', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'MISSING_USER_ID' });
    }

    const entries = await getEntriesByUser(userId);
    return res.json({ ok: true, userId, entries });
  } catch (err) {
    console.error('GET_ENTRIES_ERROR', err);
    return res.status(500).json({ ok: false, error: 'GET_FAILED' });
  }
});

module.exports = router;
