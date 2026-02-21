// /index.js
'use strict';

const express = require('express');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ===== ENV =====
const PORT = Number(process.env.PORT || 8080);
const DATA_MODE = (process.env.DATA_MODE || 'DEMO').toUpperCase(); // DEMO | LIVE
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || '';
const SPORTRADAR_BASE_URL = (process.env.SPORTRADAR_BASE_URL || '').replace(/\/+$/, ''); // no trailing slash

// ===== GCS =====
const storage = new Storage();

function nowIso() {
  return new Date().toISOString();
}

function assertAdmin(req) {
  // token can come from header OR query (mobile convenience)
  const h = (req.headers['x-admin-token'] || '').toString();
  const q = (req.query.token || '').toString();
  const t = h || q;

  if (!ADMIN_TOKEN) return { ok: false, code: 500, msg: 'ADMIN_TOKEN missing on server' };
  if (!t) return { ok: false, code: 401, msg: 'Missing admin token (x-admin-token header or ?token=)' };
  if (t !== ADMIN_TOKEN) return { ok: false, code: 403, msg: 'Invalid admin token' };
  return { ok: true };
}

function bucketReady() {
  return DATA_MODE === 'LIVE' && !!BUCKET_NAME;
}

function sportradarReady() {
  return DATA_MODE === 'LIVE' && !!SPORTRADAR_API_KEY && !!SPORTRADAR_BASE_URL;
}

function ymdPartsUTC(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { yyyy, mm, dd };
}

function toISODateUTC(d) {
  const { yyyy, mm, dd } = ymdPartsUTC(d);
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function gcsWriteJson(path, obj) {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(path);
  const body = JSON.stringify(obj, null, 2);
  await file.save(body, { contentType: 'application/json', resumable: false });
  return { path, bytes: Buffer.byteLength(body, 'utf8') };
}

async function gcsReadJson(path) {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return JSON.parse(buf.toString('utf8'));
}

function makeDemoPools() {
  const ts = nowIso();
  return {
    pools: {
      pools: [
        {
          id: 'demo-pool',
          name: 'Demo Pool',
          status: 'open',
          lockISO: ts,
        },
      ],
      meta: {
        generatedAt: ts,
        generator: 'admin_sync_demo',
        sportradarConfigured: sportradarReady(),
      },
    },
  };
}

// Build B-mode pools from Sportradar daily schedule (today + tomorrow)
async function fetchSportradarDailySchedule(dateUTC) {
  // Expect base like: https://api.sportradar.com/nba/trial/v8/en
  const { yyyy, mm, dd } = ymdPartsUTC(dateUTC);
  const url = `${SPORTRADAR_BASE_URL}/games/${yyyy}/${mm}/${dd}/schedule.json?api_key=${encodeURIComponent(
    SPORTRADAR_API_KEY
  )}`;

  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Sportradar HTTP ${res.status}`);
    err.status = res.status;
    err.body = text?.slice(0, 300);
    throw err;
  }
  return JSON.parse(text);
}

function buildPoolsFromSchedule(scheduleJson, forDateISO) {
  // We keep it simple + deterministic:
  // pool_id = `${forDateISO}__${sr_game_id}`
  // lockISO = scheduled start time (if missing, fallback now)
  const games = scheduleJson?.games || [];
  const pools = [];

  for (const g of games) {
    const srGameId = g?.id || g?.game?.id || g?.sr_id || g?.sr_game_id;
    const scheduled = g?.scheduled || g?.start_time || g?.game?.scheduled;

    if (!srGameId) continue;

    pools.push({
      id: `${forDateISO}__${srGameId}`,
      name: `NBA ${forDateISO}`,
      status: 'open',
      lockISO: scheduled || nowIso(),
      srGameId,
      home: g?.home?.name || g?.home?.alias || g?.home?.market || null,
      away: g?.away?.name || g?.away?.alias || g?.away?.market || null,
      scheduled: scheduled || null,
    });
  }

  return pools;
}

function wrapPools(pools, generatorName) {
  const ts = nowIso();
  return {
    pools: {
      pools,
      meta: {
        generatedAt: ts,
        generator: generatorName,
        sportradarConfigured: sportradarReady(),
      },
    },
  };
}

// ===== Routes =====
app.get('/api/check', (req, res) => {
  res.json({
    ok: true,
    mode: DATA_MODE,
    bucket: BUCKET_NAME || null,
    sportradarConfigured: sportradarReady(),
    ts: nowIso(),
  });
});

// Read current pools.json from GCS (or demo if not available)
app.get('/pools.json', async (req, res) => {
  try {
    if (bucketReady()) {
      const data = await gcsReadJson('pools.json');
      if (data) return res.json({ ok: true, mode: DATA_MODE, source: 'GCS:pools.json', ...data });
    }
    return res.json({ ok: true, mode: DATA_MODE, source: 'DEMO:fallback', ...makeDemoPools() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'read_failed', message: String(e?.message || e) });
  }
});

// Admin sync: write pools.json (+history +ops) to GCS
app.post('/api/admin/sync', async (req, res) => {
  const auth = assertAdmin(req);
  if (!auth.ok) return res.status(auth.code).json({ ok: false, error: auth.msg });

  const dryRun = String(req.query.dryRun || 'false').toLowerCase() === 'true';

  // If not live or bucket missing => still return demo but tell you why
  if (!bucketReady()) {
    const payload = {
      ok: true,
      mode: DATA_MODE,
      dryRun,
      bucket: BUCKET_NAME || null,
      note: 'Bucket not ready or DATA_MODE not LIVE; returning demo preview only.',
      ...makeDemoPools(),
    };
    return res.json(payload);
  }

  // === Build pools ===
  let payload;
  try {
    if (!sportradarReady()) {
      payload = wrapPools(makeDemoPools().pools.pools, 'admin_sync_demo');
    } else {
      const today = new Date();
      const tomorrow = addDaysUTC(today, 1);

      const todayISO = toISODateUTC(today);
      const tomorrowISO = toISODateUTC(tomorrow);

      const s1 = await fetchSportradarDailySchedule(today);
      const s2 = await fetchSportradarDailySchedule(tomorrow);

      const p1 = buildPoolsFromSchedule(s1, todayISO);
      const p2 = buildPoolsFromSchedule(s2, tomorrowISO);

      const merged = [...p1, ...p2];

      // If API returns nothing (off-season / error), fallback demo but mark it clearly
      if (!merged.length) {
        payload = wrapPools(makeDemoPools().pools.pools, 'admin_sync_sportradar_empty_fallback_demo');
      } else {
        payload = wrapPools(merged, 'admin_sync_sportradar');
      }
    }
  } catch (e) {
    // Hard fallback to demo, but keep the error for debugging
    payload = wrapPools(makeDemoPools().pools.pools, 'admin_sync_sportradar_error_fallback_demo');
    payload.pools.meta.error = {
      message: String(e?.message || e),
      status: e?.status || null,
      body: e?.body || null,
    };
  }

  // === Write to GCS (unless dryRun) ===
  const ts = nowIso().replace(/[:.]/g, '-'); // safe path
  const historyPath = `history/pools_${ts}.json`;
  const opsPath = `ops/last_sync.json`;

  if (dryRun) {
    return res.json({
      ok: true,
      mode: DATA_MODE,
      dryRun: true,
      bucket: BUCKET_NAME,
      wouldWrite: ['pools.json', historyPath, opsPath],
      preview: payload.pools,
    });
  }

  try {
    const wrotePools = await gcsWriteJson('pools.json', payload.pools);
    const wroteHist = await gcsWriteJson(historyPath, payload.pools);
    const wroteOps = await gcsWriteJson(opsPath, {
      ok: true,
      ts: nowIso(),
      bucket: BUCKET_NAME,
      wrote: { pools: wrotePools.path, history: wroteHist.path, ops: wroteOps.path },
      generator: payload.pools?.meta?.generator || null,
    });

    return res.json({
      ok: true,
      mode: DATA_MODE,
      bucket: BUCKET_NAME,
      wrote: { pools: wrotePools.path, history: wroteHist.path, ops: wroteOps.path },
      lastSync: { ok: true, ts: nowIso(), generator: payload.pools?.meta?.generator || null },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'gcs_write_failed',
      message: String(e?.message || e),
    });
  }
});

// Default root
app.get('/', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`shfantasy api listening on ${PORT} mode=${DATA_MODE}`);
});
