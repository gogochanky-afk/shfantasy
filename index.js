// ===============================
// Missing API routes (Hotfix)
// ===============================

// GET /api/pool?id=POOL_ID  (frontend may call this)
app.get("/api/pool", (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: "missing id" });

  // If you already have a function to list pools, reuse it.
  // Otherwise, fallback: call your existing /api/pools logic if it's in a function.
  // Minimal approach: if you store pools in DB, query here. If not, return DEMO from your existing generator.

  try {
    // --- DEMO fallback (works even without DB pools table)
    // If you already have demoPoolsFor(...) or similar, replace below accordingly.
    const dateStr = id.slice(0, 10); // expecting id like "YYYY-MM-DD-..."
    const pools = (typeof demoPoolsFor === "function") ? demoPoolsFor(dateStr) : [];
    const pool = pools.find(p => p.id === id);

    if (!pool) return res.status(404).json({ ok: false, error: "pool not found", id });
    return res.json({ ok: true, mode: "DEMO", pool });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET /api/pool/:id  (nice to have)
app.get("/api/pool/:id", (req, res) => {
  const id = req.params.id;
  req.query.id = id;
  return app._router.handle(req, res, () => {});
});

// GET /api/admin/sync-schedule  (manual trigger from browser)
app.get("/api/admin/sync-schedule", async (req, res) => {
  try {
    // If you imported syncSchedule already:
    // const { syncSchedule } = require("./scripts/sync-schedule");
    if (typeof syncSchedule !== "function") {
      return res.status(501).json({ ok: false, error: "syncSchedule() not wired in index.js" });
    }
    const result = await syncSchedule({ dryRun: false });
    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET /api/tokens (so Tokens page can show something real)
app.get("/api/tokens", (req, res) => {
  // DEMO wallet: later we bind to user auth + DB
  return res.json({
    ok: true,
    mode: "DEMO",
    wallet: {
      balance: 1200,
      currency: "CREDITS",
      updatedAt: new Date().toISOString(),
      history: [
        { ts: new Date(Date.now() - 86400000).toISOString(), type: "DAILY_BONUS", delta: +50, note: "Login bonus" },
        { ts: new Date(Date.now() - 3600000).toISOString(), type: "ENTRY_FEE", delta: -5, note: "Entered Daily Blitz" },
      ],
    },
  });
});
