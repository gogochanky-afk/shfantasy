# Cloud Run Deployment Verification Checklist

## 🚀 Deployment Status

**GitHub Commit:** `7d5e552` - "Fix: Auto-initialize DB schema and seed demo pools on startup"

**Branch:** main

**Cloud Run Service:** shfantasy (asia-east1)

---

## ✅ Pre-Deployment Checklist

### 1. Dockerfile Verification
- ✅ Dockerfile builds frontend/dist during image build
- ✅ `RUN cd frontend && pnpm run build` (Line 20)
- ✅ All dependencies installed correctly

### 2. Database Initialization
- ✅ lib/db.js auto-initializes schema on module load
- ✅ index.js auto-seeds demo pools on startup
- ✅ Idempotent (safe to run multiple times)

### 3. API Endpoints
- ✅ /api/health returns data_mode
- ✅ /api/pools returns demo pools (fallback if empty)
- ✅ /api/entries returns empty array initially

### 4. Frontend Routes
- ✅ / (home) serves index.html
- ✅ /arena serves index.html (SPA fallback)
- ✅ /my-entries serves index.html (SPA fallback)
- ✅ /how-it-works serves index.html (SPA fallback)

---

## 🧪 Post-Deployment Verification

**Base URL:** https://shfantasy-XXXXXXXX-an.a.run.app (replace with actual URL)

### Required Tests (All Must Return 200)

#### 1. Frontend Routes
```bash
# Test home page
curl -I https://shfantasy.com/
# Expected: HTTP/2 200

# Test arena page
curl -I https://shfantasy.com/arena
# Expected: HTTP/2 200

# Test my-entries page
curl -I https://shfantasy.com/my-entries
# Expected: HTTP/2 200

# Test how-it-works page
curl -I https://shfantasy.com/how-it-works
# Expected: HTTP/2 200
```

#### 2. API Endpoints
```bash
# Test health endpoint
curl https://shfantasy.com/api/health
# Expected: {"ok":true,"service":"shfantasy","data_mode":"demo","ts":"..."}

# Test pools endpoint
curl https://shfantasy.com/api/pools
# Expected: {"ok":true,"data_mode":"demo","pools":[...],"updated_at":"..."}
# MUST have at least 1 pool in the array

# Test entries endpoint
curl https://shfantasy.com/api/entries
# Expected: {"ok":true,"entries":[],"data_mode":"demo"}
```

---

## 📋 Verification Results

### ✅ Pass Criteria
- [ ] All frontend routes return HTTP 200
- [ ] All API endpoints return HTTP 200
- [ ] /api/pools returns at least 1 pool
- [ ] /api/entries returns valid JSON
- [ ] Frontend loads without errors (check browser console)
- [ ] Arena page displays pool selector
- [ ] Can select 5 players and submit entry

### ❌ Failure Scenarios

**If / returns 404:**
- Check Dockerfile: `RUN cd frontend && pnpm run build`
- Check index.js: `app.use(express.static(frontendPath))`
- Check Cloud Run logs for build errors

**If /api/pools returns empty array:**
- Check Cloud Run logs for "[Seed] Seeded X demo pools"
- Verify lib/db.js schema initialization ran
- Check for DB write permissions

**If /api/entries returns 500:**
- Check Cloud Run logs for database errors
- Verify entries table exists
- Check foreign key constraints

---

## 🔧 Environment Variables

**Required for Cloud Run:**
```
PORT=8080                    # Auto-provided by Cloud Run
DATA_MODE=demo               # or "hybrid" for Sportradar integration
TZ=Asia/Tokyo                # For date calculations
SPORTRADAR_API_KEY=<key>     # Optional (only for hybrid/live mode)
```

**Set via Cloud Run Console:**
1. Go to Cloud Run service "shfantasy"
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add environment variables
5. Deploy

---

## 📊 Expected Behavior

### On First Deployment
1. Container starts
2. lib/db.js initializes schema
3. lib/db.js seeds 16 NBA teams
4. index.js checks for pools
5. index.js seeds 3 demo pools (if empty)
6. Server starts listening on PORT

### On Subsequent Restarts
1. Container starts
2. lib/db.js checks schema (already exists)
3. index.js checks for pools (already exist)
4. Server starts immediately

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'better-sqlite3'"
**Solution:** Dockerfile already installs dependencies via `RUN npm install`

### Issue: "ENOENT: no such file or directory, open 'frontend/dist/index.html'"
**Solution:** Dockerfile already builds frontend via `RUN cd frontend && pnpm run build`

### Issue: "/api/pools returns empty array"
**Solution:** Check Cloud Run logs for "[Seed] Seeded X demo pools" message

### Issue: "Database is locked"
**Solution:** SQLite doesn't support concurrent writes. Consider upgrading to PostgreSQL for production.

---

## 📝 Next Steps After Verification

1. ✅ Verify all routes return 200
2. ✅ Test Arena page flow (select 5 players, submit)
3. ✅ Test My Entries page (shows submitted entry)
4. ✅ Check Cloud Run logs for errors
5. ✅ Monitor Cloud Run metrics (requests, latency, errors)

---

## 🎯 Success Criteria

**Deployment is successful when:**
- ✅ All 7 routes return HTTP 200
- ✅ /api/pools returns at least 1 pool
- ✅ Arena page loads and displays pools
- ✅ Can submit entry and see it in My Entries
- ✅ No errors in Cloud Run logs
- ✅ No errors in browser console

---

## 📞 Support

If any verification step fails:
1. Check Cloud Run logs: `gcloud run services logs read shfantasy --region=asia-east1`
2. Check GitHub commit: https://github.com/gogochanky-afk/shfantasy/commit/7d5e552
3. Review TEST_REPORT.md for local test results
4. Verify Dockerfile and cloudbuild.yaml are correct

---

**Last Updated:** 2026-02-15  
**Commit:** 7d5e552  
**Status:** Ready for deployment
