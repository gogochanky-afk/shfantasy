# SH Fantasy — Snapshot Mode

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
  Source priority:
    1. Sportradar (if SPORTRADAR_API_KEY set and no 429)
    2. ESPN public API (no key required, always current rosters)
    3. BallDontLie schedule + ESPN rosters (fallback)
    4. Keep existing snapshots unchanged (if all fail)
```

---

## How to Refresh Snapshots

### Option A: ESPN Free API (no key required, always current rosters)

```bash
cd /path/to/shfantasy
node scripts/generateSnapshots.js
```

ESPN public API is used automatically. No API key required. Rosters reflect
the latest trades and signings.

### Option B: With Sportradar API Key (highest priority)

```bash
SPORTRADAR_API_KEY=your_key_here \
SPORTRADAR_NBA_ACCESS_LEVEL=trial \
node scripts/generateSnapshots.js
```

Sportradar is tried first; on 429 or failure it falls back to ESPN.

### Option C: BallDontLie with API Key (optional, schedule + ESPN rosters)

```bash
BALLDONTLIE_API_KEY=your_bdl_key \
node scripts/generateSnapshots.js
```

BDL provides schedule data; rosters are always fetched from ESPN (current data).

---

## Rate-Limit Behaviour

- All HTTP requests are **serial** with a minimum **1200 ms** gap between calls.
- On HTTP **429** the script performs **exponential backoff**:
  - Delays: 2 s → 4 s → 8 s → 16 s → 20 s (cap)
  - Maximum **5 retries** per request before giving up and falling back.
- Sportradar 429 on the schedule endpoint causes an immediate fallback to ESPN
  (no retries wasted on a quota-exhausted key).

---

## Fallback Behaviour

| Condition | Behaviour |
|-----------|-----------|
| Sportradar 429 or error | Fall back to ESPN immediately |
| ESPN error | Fall back to BDL schedule + ESPN rosters |
| All sources fail | Existing snapshots preserved (no overwrite) |
| Pool has < 10 players | Pool skipped (no player file written) |

---

## Pool ID Convention

```
pool-<home_abbr_lower>-<away_abbr_lower>-today   (e.g. pool-gsw-lal-today)
pool-<home_abbr_lower>-<away_abbr_lower>-tmrw    (e.g. pool-lal-sac-tmrw)
```

Home/away abbreviations are **standard 2-3 char NBA abbreviations**.
ESPN non-standard abbreviations are normalised automatically:
`GS`→`GSW`, `NY`→`NYK`, `SA`→`SAS`, `NO`→`NOP`, `UTAH`→`UTA`, `WSH`→`WAS`.

---

## Cost Tier Assignment

Players are assigned cost tiers **1–4** based on position weight within each
team roster:

| Rank (within team) | Cost |
|--------------------|------|
| 1–2 (top centres/bigs) | $4 |
| 3–5 | $3 |
| 6–9 | $2 |
| 10+ | $1 |

Position weights: C > PF/SF > PG/SG > G/F.

---

## Output Files

After successful generation:

```
data/snapshots/
  pools.snapshot.json                        ← today + tomorrow pools (all games)
  players.pool-<home>-<away>-today.json      ← players for each pool
  players.pool-<home>-<away>-tmrw.json
  players.fallback.json                      ← emergency fallback
```

---

## API Response Format

### GET /api/pools (or /pools)

```json
{
  "ok": true,
  "dataMode": "SNAPSHOT",
  "updatedAt": "2026-02-28T16:53:37.186Z",
  "pools": [
    {
      "id": "pool-gsw-lal-today",
      "label": "GSW vs LAL",
      "title": "Golden State Warriors vs Los Angeles Lakers",
      "homeTeam": { "id": "9", "abbr": "GSW", "name": "Golden State Warriors" },
      "awayTeam": { "id": "13", "abbr": "LAL", "name": "Los Angeles Lakers" },
      "lockAt": "2026-02-28T03:00Z",
      "rosterSize": 5,
      "salaryCap": 10,
      "status": "open",
      "day": "today",
      "source": "espn"
    }
  ]
}
```

### GET /api/players?poolId=pool-gsw-lal-today (or /players?poolId=...)

```json
{
  "ok": true,
  "dataMode": "SNAPSHOT",
  "updatedAt": "2026-02-28T16:53:37.185Z",
  "poolId": "pool-gsw-lal-today",
  "players": [
    {
      "id": "espn-3213",
      "name": "Al Horford",
      "team": "GSW",
      "teamFull": "Golden State Warriors",
      "position": "C",
      "jersey": "20",
      "cost": 4
    }
  ]
}
```

---

## Roster Correctness

Rosters are sourced from **ESPN's live roster API** which reflects the current
season's transactions. Examples as of 2026-02-28:

- **Anthony Davis** → `WAS` (Washington Wizards) — traded from LAL
- **Luka Doncic** → `LAL` (Los Angeles Lakers) — traded from DAL
- **Stephen Curry** → `GSW` (Golden State Warriors)
- **LeBron James** → `LAL` (Los Angeles Lakers)

---

## Timezone

All dates use **UTC**. Today and tomorrow are computed as UTC calendar dates.
`lockAt` values come from ESPN's game schedule (UTC ISO-8601 strings).

---

## Verify Endpoints After Generation

```bash
# Start server locally
DATA_MODE=SNAPSHOT PORT=8090 node index.js &

# 1. Health check
curl -s http://localhost:8090/api/healthz

# 2. Pools
curl -s http://localhost:8090/api/pools | python3 -m json.tool

# 3. Players for first pool
POOL_ID=$(curl -s http://localhost:8090/api/pools | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d['pools'][0]['id'])")
curl -s "http://localhost:8090/api/players?poolId=$POOL_ID" | python3 -m json.tool
```

---

## CI / Cron Refresh

To keep snapshots fresh, run the generator before each Cloud Run deployment:

```yaml
# cloudbuild.yaml step
- name: 'node:22'
  entrypoint: 'node'
  args: ['scripts/generateSnapshots.js']
  env: ['DATA_MODE=SNAPSHOT']
```

Or schedule a daily cron job:

```bash
# Example: refresh at 06:00 UTC daily
0 6 * * * cd /path/to/shfantasy && node scripts/generateSnapshots.js && \
  git add data/snapshots && git commit -m "chore: refresh snapshots" && git push
```

---

## DATA_MODE Behaviour

| DATA_MODE | Pools source | Players source | Sportradar calls |
|-----------|-------------|----------------|-----------------|
| `SNAPSHOT` (default) | `data/snapshots/pools.snapshot.json` | `data/snapshots/players.<poolId>.json` | **NEVER** |
| `LIVE` | Sportradar API (not yet implemented) | Sportradar API | Yes (with cache) |

Set `DATA_MODE=SNAPSHOT` in Cloud Run environment variables to ensure stable trial mode.
