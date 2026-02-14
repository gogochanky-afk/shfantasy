const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Cloud Run uses PORT env
const PORT = process.env.PORT || 8080;

// DATA_MODE: "demo" | "live"
const DATA_MODE = process.env.DATA_MODE || "demo";

/**
 * API health check (used by frontend + monitoring)
 */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "shfantasy",
    data_mode: DATA_MODE,
    ts: new Date().toISOString(),
  });
});

/**
 * Simple homepage (temporary UI)
 */
app.get("/", (req, res) => {
  res.status(200).type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SHFantasy</title>
  <style>
    body { font-family: -apple-system, system-ui, Arial; background:#0b0b0b; color:#f5f5f5; padding:24px; }
    .box { max-width:720px; margin:0 auto; }
    .card { border:1px solid #222; border-radius:12px; padding:16px; margin:12px 0; background:#111; }
    a { color:#7dd3fc; text-decoration:none; }
    .muted { color:#aaa; font-size:14px; }
    button { padding:10px 14px; border-radius:10px; border:1px solid #333; background:#161616; color:#fff; }
    pre { white-space:pre-wrap; word-break:break-word; }
  </style>
</head>
<body>
  <div class="box">
    <h1>SHFantasy ✅</h1>
    <div class="muted">Backend is live • DATA_MODE=<b>${DATA_MODE}</b></div>

    <div class="card">
      <h3>Health Status</h3>
      <button onclick="checkHealth()">Check /api/health</button>
      <pre id="out" class="muted"></pre>
    </div>

    <div class="card">
      <h3>Next</h3>
      <div>1) We’ll add a real frontend (React/Vite) later.</div>
      <div>2) Keep everything on Cloud Run for stability.</div>
      <div class="muted">Tip: open <a href="/api/health">/api/health</a> to verify.</div>
    </div>
  </div>

<script>
async function checkHealth(){
  const out = document.getElementById("out");
  out.textContent = "checking...";
  try{
    const r = await fetch("/api/health");
    const j = await r.json();
    out.textContent = JSON.stringify(j, null, 2);
  }catch(e){
    out.textContent = "error: " + e.message;
  }
}
</script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`SHFantasy listening on ${PORT}`);
});
