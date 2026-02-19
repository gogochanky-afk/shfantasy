// ------------------------------
// Join Pool (LIVE + DEMO safe)
// ------------------------------
app.post('/api/join', async (req, res) => {
  try {
    const { username, poolId } = req.body;

    if (!username || !poolId) {
      return res.status(400).json({ ok: false, error: 'Missing username or poolId' });
    }

    const entryId = `${poolId}_${username}`;

    // DEMO MODE → in-memory
    if (MODE === 'DEMO' || !db) {
      return res.json({
        ok: true,
        mode: MODE,
        entry: {
          id: entryId,
          username,
          poolId,
          createdAt: new Date().toISOString()
        }
      });
    }

    // LIVE MODE → Firestore
    const entryRef = db.collection('entries').doc(entryId);

    await entryRef.set({
      username,
      poolId,
      createdAt: new Date(),
      lineup: []
    });

    return res.json({
      ok: true,
      mode: MODE,
      entryId
    });

  } catch (err) {
    console.error('JOIN ERROR', err);
    return res.status(500).json({ ok: false, error: 'Join failed' });
  }
});
