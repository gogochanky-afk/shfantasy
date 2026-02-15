# Phase 3 Test Report

## ✅ Acceptance Criteria

### A) /api/health - Returns data_mode
```json
{
  "ok": true,
  "service": "shfantasy",
  "data_mode": "demo",
  "ts": "2026-02-15T07:20:16.035Z"
}
```
✅ PASS

### B) /api/pools - Returns today+tomorrow pools (max 6)
```json
{
  "ok": true,
  "data_mode": "demo",
  "pools": [
    {
      "pool_id": "2026-02-15_demo-game-1",
      "date": "2026-02-15",
      "home": {
        "abbr": "LAL",
        "name": "Los Angeles Lakers"
      },
      "away": {
        "abbr": "GSW",
        "name": "Golden State Warriors"
      },
      "lock_time": "2026-02-15T09:21:23.377Z",
      "status": "open"
    },
    {
      "pool_id": "2026-02-15_demo-game-2",
      "date": "2026-02-15",
      "home": {
        "abbr": "MIL",
        "name": "Milwaukee Bucks"
      },
      "away": {
        "abbr": "BOS",
        "name": "Boston Celtics"
      },
      "lock_time": "2026-02-15T11:21:23.377Z",
      "status": "open"
    },
    {
      "pool_id": "2026-02-16_demo-game-3",
      "date": "2026-02-16",
      "home": {
        "abbr": "GSW",
        "name": "Golden State Warriors"
      },
      "away": {
        "abbr": "MIL",
        "name": "Milwaukee Bucks"
      },
      "lock_time": "2026-02-16T09:21:23.377Z",
      "status": "open"
    }
  ],
  "updated_at": "2026-02-15T07:21:27.841Z"
}
```
✅ PASS - 3 pools returned (today+tomorrow)

### C) Deterministic pool_id = ${date}_${sr_game_id}
- pool_id format: `2026-02-15_demo-game-1`
- Same game always gets same pool_id
✅ PASS

### D) Fallback to demo on API failure
- DATA_MODE=demo: Uses demo pools from DB
- DATA_MODE=hybrid: Falls back to demo if Sportradar fails
- UI shows data_mode badge
✅ PASS

### E) Arena page: Select 5 players, cap<=10, submit works
- Pool selector dropdown ✅
- Roster loaded via /api/roster ✅
- Player selection (max 5) ✅
- Cost tracker (cap 10) ✅
- Submit validation ✅
- My Entries shows submitted entry ✅
✅ PASS

### F) DB additive changes only
- Created new tables: nba_teams, team_mappings, pools, roster_snapshots, entries
- No destructive changes
- All migrations are additive
✅ PASS

---

## 📊 API Sample Responses

### GET /api/roster?pool_id=2026-02-15_demo-game-1
```json
{
  "ok": true,
  "pool_id": "2026-02-15_demo-game-1",
  "mode": "demo_roster",
  "updated_at": "2026-02-15T07:21:31.456Z",
  "players": [
    {
      "id": "p1",
      "name": "LeBron James",
      "team": "LAL",
      "position": "SF",
      "price": 4,
      "injury_status": null
    },
    {
      "id": "p2",
      "name": "Stephen Curry",
      "team": "GSW",
      "position": "PG",
      "price": 4,
      "injury_status": null
    },
    ... (20 players total)
  ]
}
```

### POST /api/entries (Success)
```json
{
  "ok": true,
  "entry_id": "entry-1771140103883-8gt5lmdq6",
  "entry": {
    "entry_id": "entry-1771140103883-8gt5lmdq6",
    "pool_id": "2026-02-15_demo-game-1",
    "player_ids": ["p11", "p12", "p16", "p17", "p18"],
    "total_cost": 7,
    "status": "active",
    "score": 0,
    "rank": null
  }
}
```

### POST /api/entries (Validation Error)
```json
{
  "ok": false,
  "error": "Total cost 11 exceeds salary cap of 10"
}
```

### GET /api/entries
```json
{
  "ok": true,
  "entries": [
    {
      "id": "entry-1771140103883-8gt5lmdq6",
      "pool_id": "2026-02-15_demo-game-1",
      "pool_name": "LAL vs GSW",
      "players": [
        {
          "id": "p11",
          "name": "Devin Booker",
          "team": "PHX",
          "position": "SG",
          "price": 2,
          "injury_status": null
        },
        ... (5 players total)
      ],
      "total_cost": 7,
      "status": "active",
      "score": 0,
      "rank": null,
      "created_at": "2026-02-15T07:21:43.883Z"
    }
  ],
  "data_mode": "demo"
}
```

---

## 🗂️ Files Changed

### New Files:
- `lib/sportradar.js` - Sportradar API integration
- `lib/db.js` - Database helpers
- `lib/roster.js` - Roster generation
- `db-init.js` - Database schema initialization
- `seed-demo-pools.js` - Demo pool seeding
- `shfantasy.db` - SQLite database

### Modified Files:
- `index.js` - Complete refactor with new API structure
- `package.json` - Added better-sqlite3, axios
- `frontend/src/pages/Arena.jsx` - New API integration

---

## 🗄️ Database Schema

### nba_teams (canonical)
```sql
CREATE TABLE nba_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sr_team_id TEXT UNIQUE,
  abbr TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### pools (deterministic)
```sql
CREATE TABLE pools (
  pool_id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  sr_game_id TEXT,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  lock_time DATETIME NOT NULL,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_team_id) REFERENCES nba_teams(id),
  FOREIGN KEY (away_team_id) REFERENCES nba_teams(id)
)
```

### roster_snapshots (single source of truth)
```sql
CREATE TABLE roster_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pool_id TEXT NOT NULL,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,
  data_json TEXT NOT NULL,
  checksum TEXT,
  FOREIGN KEY (pool_id) REFERENCES pools(pool_id)
)
```

### entries
```sql
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT UNIQUE NOT NULL,
  pool_id TEXT NOT NULL,
  player_ids TEXT NOT NULL,
  total_cost INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  score INTEGER DEFAULT 0,
  rank INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES pools(pool_id)
)
```

---

## 🚀 Environment Variables

Required for Cloud Run:
- `SPORTRADAR_API_KEY` - Sportradar API key (optional for demo mode)
- `DATA_MODE` - "demo" | "hybrid" | "live" (default: "hybrid")
- `TZ` - "Asia/Tokyo" (for date calculations)
- `PORT` - Server port (Cloud Run provides this)

---

## ✅ All Tests Passed

- ✅ /api/health returns data_mode
- ✅ /api/pools returns today+tomorrow pools
- ✅ Deterministic pool_id format
- ✅ Fallback to demo on API failure
- ✅ Arena page: select 5 players, cap<=10, submit
- ✅ My Entries shows submitted entries
- ✅ DB additive changes only
- ✅ Frontend build successful
- ✅ All routes working (/, /arena, /my-entries, /how-it-works)

---

## 📝 Next Steps

1. Push to GitHub: `git push origin main`
2. Set Cloud Run environment variables:
   - SPORTRADAR_API_KEY (if using hybrid/live mode)
   - DATA_MODE=hybrid
   - TZ=Asia/Tokyo
3. Deploy to Cloud Run (automatic via cloudbuild.yaml)
4. Verify shfantasy.com works end-to-end
