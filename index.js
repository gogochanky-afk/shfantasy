// /index.js
const path = require("path");
const express = require("express");
const { getFirestore } = require("./firebase-init");

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Initialize Firestore
const db = getFirestore();

// ===== DEMO POOLS =====
const DEMO_POOLS = [
  { id: "demo-today", name: "Today Arena", salaryCap: 10, rosterSize: 5, date: "today" },
  { id: "demo-tomorrow", name: "Tomorrow Arena", salaryCap: 10, rosterSize: 5, date: "tomorrow" },
];

// ===== DEMO PLAYERS (mixed costs 1-4) =====
const DEMO_PLAYERS = [
  // cost 4 (stars)
  { id: "p1", name: "Nikola Jokic", cost: 4 },
  { id: "p2", name: "Luka Doncic", cost: 4 },
  { id: "p3", name: "Giannis Antetokounmpo", cost: 4 },
  { id: "p4", name: "Shai Gilgeous-Alexander", cost: 4 },
  { id: "p5", name: "Joel Embiid", cost: 4 },

  // cost 3 (all-stars)
  { id: "p6", name: "Stephen Curry", cost: 3 },
  { id: "p7", name: "Kevin Durant", cost: 3 },
  { id: "p8", name: "Jayson Tatum", cost: 3 },
  { id: "p9", name: "LeBron James", cost: 3 },
  { id: "p10", name: "Anthony Davis", cost: 3 },
  { id: "p11", name: "Kyrie Irving", cost: 3 },
  { id: "p12", name: "Jimmy Butler", cost: 3 },

  // cost 2 (solid starters)
  { id: "p13", name: "Ja Morant", cost: 2 },
  { id: "p14", name: "Devin Booker", cost: 2 },
  { id: "p15", name: "Damian Lillard", cost: 2 },
  { id: "p16", name: "Donovan Mitchell", cost: 2 },
  { id: "p17", name: "Bam Adebayo", cost: 2 },

  // cost 1 (value picks)
  { id: "p18", name: "Derrick White", cost: 1 },
  { id: "p19", name: "Mikal Bridges", cost: 1 },
  { id: "p20", name: "Jarrett Allen", cost: 1 },
  { id: "p21", name: "Aaron Gordon", cost: 1 },
  { id: "p22", name: "Austin Reaves", cost: 1 },
];

// ===== HELPERS =====
function normUsername(s) {
  return (s || "").toString().trim().slice(0, 32);
}

function getPool(poolId) {
  return DEMO_POOLS.find((p) => p.id === poolId) || null;
}

function toPlayerDetails(playerIds) {
  const details = (playerIds || []).map((id) => DEMO_PLAYERS.find((p) => p.id === id) || { id, name: "Unknown", cost: 0 });
  const totalCost = details.reduce((sum, p) => sum + (p.cost || 0), 0);
  return { details, totalCost };
}

// ===== HEALTH =====
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===== POOLS =====
app.get("/api/pools", (req, res) => {
  res.json({ mode: "DEMO", pools: DEMO_POOLS });
});

// ===== PLAYERS =====
app.get("/api/players", (req, res) => {
  res.json({ mode: "DEMO", players: DEMO_PLAYERS });
});

/**
 * ===== JOIN POOL (idempotent, professional UX)
 * 如果同一 username + poolId 已經有 entry，就返返同一個（避免 second join 亂）
 * 規則：取最新一個 entry（createdAt desc）
 */
app.post("/api/join", async (req, res) => {
  try {
    const poolId = (req.body?.poolId || "").toString().trim();
    const username = normUsername(req.body?.username);

    if (!poolId || !username) {
      return res.status(400).json({ ok: false, error: "poolId and username required" });
    }

    const pool = getPool(poolId);
    if (!pool) {
      return res.status(400).json({ ok: false, error: "Invalid poolId" });
    }

    // Try find existing latest entry for same user+pool
    const existingSnap = await db
      .collection("entries")
      .where("username", "==", username)
      .where("poolId", "==", poolId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      const data = doc.data();
      return res.json({
        ok: true,
        reused: true,
        entryId: doc.id, // IMPORTANT: doc.id is the document id used by /api/lineup update
        poolId: data.poolId,
        username: data.username,
        createdAt: data.createdAt,
      });
    }

    const createdAt = new Date().toISOString();
    const entryRef = db.collection("entries").doc();

    await entryRef.set({
      username,
      poolId,
      players: [],
      createdAt,
      updatedAt: createdAt,
    });

    res.json({
      ok: true,
      reused: false,
      entryId: entryRef.id,
      poolId,
      username,
      createdAt,
    });
  } catch (error) {
    console.error("[/api/join] Error:", error);
    res.status(500).json({ ok: false, error: "Failed to create/reuse entry" });
  }
});

// ===== MY ENTRIES =====
app.get("/api/my-entries", async (req, res) => {
  try {
    const username = normUsername(req.query.username);
    if (!username) {
      return res.status(400).json({ ok: false, error: "username required" });
    }

    const snapshot = await db
      .collection("entries")
      .where("username", "==", username)
      .orderBy("createdAt", "desc")
      .get();

    const entries = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const { details, totalCost } = toPlayerDetails(data.players || []);

      entries.push({
        id: doc.id,
        poolId: data.poolId,
        username: data.username,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt || data.createdAt,
        lineup: (data.players || []).length
          ? {
              players: details,
              totalCost,
            }
          : null,
      });
    });

    res.json({ ok: true, mode: "DEMO", username, entries });
  } catch (error) {
    console.error("[/api/my-entries] Error:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch entries" });
  }
});

// ===== SAVE LINEUP =====
app.post("/api/lineup", async (req, res) => {
  try {
    const entryId = (req.body?.entryId || "").toString().trim();
    const poolId = (req.body?.poolId || "").toString().trim();
    const username = normUsername(req.body?.username);
    const players = req.body?.players;

    if (!entryId || !poolId || !username || !Array.isArray(players)) {
      return res.status(400).json({ ok: false, error: "entryId, poolId, username, players required" });
    }

    const pool = getPool(poolId);
    if (!pool) {
      return res.status(400).json({ ok: false, error: "Invalid poolId" });
    }

    if (players.length !== pool.rosterSize) {
      return res.status(400).json({ ok: false, error: `Roster must be exactly ${pool.rosterSize} players` });
    }

    const { totalCost } = toPlayerDetails(players);
    if (totalCost > pool.salaryCap) {
      return res.status(400).json({ ok: false, error: `Total cost ${totalCost} exceeds cap ${pool.salaryCap}` });
    }

    const entryRef = db.collection("entries").doc(entryId);
    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) {
      return res.status(404).json({ ok: false, error: "Entry not found" });
    }

    // Security-ish check: ensure same user & pool
    const existing = entryDoc.data();
    if (existing.username !== username || existing.poolId !== poolId) {
      return res.status(403).json({ ok: false, error: "Entry ownership mismatch" });
    }

    const updatedAt = new Date().toISOString();
    await entryRef.update({ players, updatedAt });

    res.json({ ok: true, totalCost, updatedAt });
  } catch (error) {
    console.error("[/api/lineup] Error:", error);
    res.status(500).json({ ok: false, error: "Failed to save lineup" });
  }
});

// ===== GET LINEUP (for draft page load) =====
app.get("/api/lineup", async (req, res) => {
  try {
    const entryId = (req.query.entryId || "").toString().trim();
    if (!entryId) {
      return res.status(400).json({ ok: false, error: "entryId required" });
    }

    const entryRef = db.collection("entries").doc(entryId);
    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) {
      return res.status(404).json({ ok: false, error: "Entry not found" });
    }

    const data = entryDoc.data();
    const pool = getPool(data.poolId);
    const { details, totalCost } = toPlayerDetails(data.players || []);

    res.json({
      ok: true,
      entry: {
        id: entryDoc.id,
        poolId: data.poolId,
        username: data.username,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt || data.createdAt,
        players: data.players || [],
      },
      pool,
      lineup: {
        players: details,
        totalCost,
      },
    });
  } catch (error) {
    console.error("[/api/lineup GET] Error:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch lineup" });
  }
});

/**
 * ✅ SPA fallback（關鍵）
 * 任何非 /api/* 都回 index.html，避免你再見到 JSON 畫面
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});
