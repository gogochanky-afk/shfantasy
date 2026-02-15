# SHFantasy Deployment Guide

## Architecture

- **Backend**: Express.js (Node 18+)
- **Frontend**: React + Vite
- **Hosting**: Google Cloud Run
- **DNS**: Cloudflare (DNS only, no proxy)

## Project Structure

```
shfantasy/
├── index.js              # Express server (serves API + React build)
├── package.json          # Root dependencies
├── Dockerfile            # Cloud Run build config
├── frontend/             # React + Vite app
│   ├── src/
│   │   ├── App.jsx       # Main component
│   │   ├── App.css       # Dark theme styles
│   │   └── main.jsx      # Entry point
│   ├── package.json      # Frontend dependencies
│   └── vite.config.js    # Vite config
└── DEPLOYMENT.md         # This file
```

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   cd frontend && pnpm install && cd ..
   ```

2. **Build frontend**:
   ```bash
   npm run build
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Open browser**:
   - http://localhost:8080/
   - http://localhost:8080/api/health

## Deploy to Cloud Run

### Option 1: Automatic (Continuous Deployment)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Cloud Run**
3. Select your service (or create new)
4. Click **"EDIT & DEPLOY NEW REVISION"**
5. Under "Container", select **"Continuously deploy from a repository"**
6. Click **"SET UP CLOUD BUILD"**
7. Choose **GitHub** → Authorize → Select `gogochanky-afk/shfantasy`
8. Branch: `^main$`
9. Build Type: **Dockerfile**
10. Click **"SAVE"** and **"DEPLOY"**

### Option 2: Manual (gcloud CLI)

```bash
# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Deploy
gcloud run deploy shfantasy \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATA_MODE=demo
```

## Environment Variables

Set in Cloud Run:

- `PORT`: Auto-set by Cloud Run (default: 8080)
- `DATA_MODE`: `demo` or `live`

## DNS Configuration (Cloudflare)

### Root Domain (@)

Add 4 A records (Google Cloud Load Balancer IPs):

```
Type: A, Name: @, Content: 216.239.32.21, Proxy: DNS only
Type: A, Name: @, Content: 216.239.34.21, Proxy: DNS only
Type: A, Name: @, Content: 216.239.36.21, Proxy: DNS only
Type: A, Name: @, Content: 216.239.38.21, Proxy: DNS only
```

### www Subdomain

```
Type: CNAME, Name: www, Content: ghs.googlehosted.com, Proxy: DNS only
```

**Important**: All records MUST be "DNS only" (gray cloud), NOT "Proxied" (orange cloud).

## Verification

After deployment:

1. **Check Cloud Run URL**:
   ```bash
   curl https://shfantasy-xxxxx-uc.a.run.app/api/health
   ```

2. **Check Custom Domain**:
   ```bash
   curl https://shfantasy.com/api/health
   ```

3. **Open in Browser**:
   - https://shfantasy.com/ → Should show React app
   - https://shfantasy.com/api/health → Should return JSON

## Troubleshooting

### Frontend not loading

- Check if `frontend/dist/` exists after build
- Verify Express serves static files from `frontend/dist`
- Check Cloud Run logs for errors

### API not working

- Verify `/api/health` returns JSON
- Check `DATA_MODE` environment variable
- Review Cloud Run logs

### DNS not resolving

- Wait 5-30 minutes for DNS propagation
- Use `dig shfantasy.com` to check DNS records
- Verify all records are "DNS only" (not Proxied)

### Custom domain not working

- Go to Cloud Run → Service → **MANAGE CUSTOM DOMAINS**
- Add `shfantasy.com` and `www.shfantasy.com`
- Follow verification steps

## Features

- ✅ Dark theme UI
- ✅ Mobile-first responsive design
- ✅ Backend health check (auto-refresh every 30s)
- ✅ DATA_MODE display (demo/live)
- ✅ Enter Arena button (placeholder)
- ✅ My Entries button (placeholder)
- ✅ SPA routing support

## Next Steps

1. Implement Arena page (pools listing)
2. Implement My Entries page (user lineups)
3. Add authentication (OAuth)
4. Connect to NBA data API
5. Implement lineup builder
6. Add scoring system
