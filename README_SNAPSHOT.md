# SH Fantasy — Snapshot Playtest Mode

## Overview

**DATA_MODE=SNAPSHOT** is the stable trial mode for SH Fantasy.

- **Zero Sportradar calls at runtime** — Cloud Run only reads local JSON files
- **Zero sqlite / better-sqlite3 / DB** — no database required
- **Deterministic** — same data every request until snapshots are regenerated
- **Fallback-safe** — if snapshot generation fails, old snapshots are preserved

---

## Architecture

```
Cloud Run (runtime)
  index.js
    └─ routes/pools.js   → lib/snapshotStore.js → data/snapshots/pools.snapshot.json
    └─ routes/players.js → lib/snapshotStore.js → data/snapshots/players.<poolId>.json
                                                 → data/snapshots/players.fallback.json
                                                 → hardcoded fallback (last resort)

scripts/generateSnapshots.js  (build-time / manual — NOT called at runtime)
  1. Sportradar (if SPORTRADAR_API_KEY set and no 429)
  2. BallDontLie free API (automatic fallback, no key required)
  3. Keep existing snapshots unchanged (if both fail)
```

---

## How to Generate Today + Tomorrow Real Snapshots

### Option A: With Sportradar API Key

```bash
cd /path/to/shfantasy

SPORTRADAR_API_KEY=your_key_here \
SPORTRADAR_NBA_ACCESS_LEVEL=trial \
node scripts/generateSnapshots.js
```

### Option B: BallDontLie Free API (no key required)

```bash
cd /path/to/shfantasy
node scripts/generateSnapshots.js
```

The script automatically falls back to BallDontLie if Sportradar is unavailable or rate-limited.

### Option C: BallDontLie with API Key (higher rate limit)

```bash
BALLDONTLIE_API_KEY=your_bdl_key \
node scripts/generateSnapshots.js
```

---

## Output Files

After successful generation:

```
data/snapshots/
  pools.snapshot.json              ← today + tomorrow pools
  players.pool-<home>-<away>-today.json   ← players for each pool
  players.pool-<home>-<away>-tmrw.json
  players.fallback.json            ← emergency fallback (14 hardcoded players)
```

---

## Verify Endpoints After Generation

```bash
# Start server locally
DATA_MODE=SNAPSHOT PORT=8080 node index.js &

# 1. Health check
curl -s http://localhost:8080/healthz | python3 -m json.tool

# 2. Pools
curl -s http://localhost:8080/api/pools | python3 -m json.tool

# 3. Players for first pool
POOL_ID=$(curl -s http://localhost:8080/api/pools | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pools'][0]['id'])")
curl -s "http://localhost:8080/api/players?poolId=$POOL_ID" | python3 -m json.tool
```

Expected responses:

```json
// GET /healthz
{"ok":true,"dataMode":"SNAPSHOT","source":"snapshot","updatedAt":"...","ts":"..."}

// GET /api/pools
{"ok":true,"dataMode":"SNAPSHOT","updatedAt":"...","pools":[...]}

// GET /api/players?poolId=pool-lal-gsw-today
{"ok":true,"dataMode":"SNAPSHOT","poolId":"pool-lal-gsw-today","players":[...]}
```

---

## DATA_MODE Behaviour

| DATA_MODE | Pools source | Players source | Sportradar calls |
|-----------|-------------|----------------|-----------------|
| `SNAPSHOT` (default) | `data/snapshots/pools.snapshot.json` | `data/snapshots/players.<poolId>.json` | **NEVER** |
| `LIVE` | Sportradar API (not yet implemented) | Sportradar API | Yes (with cache) |

Set `DATA_MODE=SNAPSHOT` in Cloud Run environment variables to ensure stable trial mode.

---

## Rate Limit Protection

- `generateSnapshots.js` throttles requests: **1.2 seconds between each API call**
- Only fetches **today + tomorrow** (2 schedule calls + N roster calls)
- On 429: stops immediately, keeps existing snapshots unchanged
- On any error: logs clearly with status code + endpoint + fallback path

---

## Full User Flow (Trial)

1. Open `/` → see DATA MODE: SNAPSHOT badge + pool cards
2. Enter username → click "Join & Draft" → redirected to `/draft.html?poolId=...&entryId=...`
3. Draft page shows 10-18 players (correct teams for that pool)
4. Select 5 players within $10 salary cap → click "Save Lineup"
5. Open `/my-entries.html` → see saved lineup

All data stored in `localStorage` — no server-side persistence required.
