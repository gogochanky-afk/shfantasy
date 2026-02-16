import React, { useEffect, useMemo, useState } from "react";

export default function App() {
  const [mode, setMode] = useState("UNKNOWN");
  const [pools, setPools] = useState([]);
  const [err, setErr] = useState("");

  const apiBase = useMemo(() => "", []);

  useEffect(() => {
    fetch(`${apiBase}/api/pools`)
      .then((r) => r.json())
      .then((j) => {
        setMode(j?.mode || "UNKNOWN");
        setPools(j?.pools || []);
      })
      .catch((e) => setErr(String(e)));
  }, [apiBase]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>SH Fantasy</div>
          <div style={styles.sub}>Daily Blitz · pooled payout · skill-based</div>
        </div>
        <div style={styles.badge}>
          DATA_MODE: <b style={{ marginLeft: 6 }}>{mode}</b>
        </div>
      </div>

      {err ? (
        <div style={styles.card}>
          <div style={styles.title}>API Error</div>
          <div style={styles.mono}>{err}</div>
        </div>
      ) : null}

      <div style={styles.hero}>
        <div style={styles.heroTitle}>Pick 5. Stay under 10 credits.</div>
        <div style={styles.heroText}>
          No fixed odds. No bookmaker. Win by reading value & chaos.
        </div>
      </div>

      <div style={styles.sectionTitle}>Today + Tomorrow Pools</div>
      <div style={styles.grid}>
        {pools.map((p) => (
          <div key={p.id} style={styles.poolCard}>
            <div style={styles.poolName}>{p.name}</div>
            <div style={styles.poolMeta}>
              <span>Cap: <b>{p.salaryCap}</b></span>
              <span>Roster: <b>{p.rosterSize}</b></span>
              <span>Entry: <b>{p.entryFee}</b></span>
              <span>Prize: <b>{p.prize}</b></span>
            </div>
            <button
              style={styles.cta}
              onClick={() => alert("Next: Lineup Builder (Phase 2)")}
            >
              Enter Pool →
            </button>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <div style={styles.footerLine}>Alpha goal: stable pools → lineup builder → submit entries.</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b0e14",
    color: "#e8eefc",
    padding: 18,
    fontFamily:
      "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  brand: { fontSize: 20, fontWeight: 800, letterSpacing: 0.2 },
  sub: { opacity: 0.75, marginTop: 4, fontSize: 13 },
  badge: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 12,
  },
  hero: {
    borderRadius: 16,
    padding: 16,
    background:
      "linear-gradient(135deg, rgba(80,200,255,0.16), rgba(130,90,255,0.10))",
    border: "1px solid rgba(255,255,255,0.10)",
    marginBottom: 18,
  },
  heroTitle: { fontSize: 18, fontWeight: 800 },
  heroText: { marginTop: 8, opacity: 0.8, fontSize: 13, lineHeight: 1.5 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10, opacity: 0.9 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  poolCard: {
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  poolName: { fontWeight: 800, marginBottom: 10 },
  poolMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 12,
    opacity: 0.85,
    marginBottom: 12,
  },
  cta: {
    width: "100%",
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(80,200,255,0.12)",
    color: "#e8eefc",
    fontWeight: 800,
    cursor: "pointer",
  },
  card: {
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,80,80,0.10)",
    border: "1px solid rgba(255,80,80,0.18)",
    marginBottom: 12,
  },
  title: { fontWeight: 800, marginBottom: 8 },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 },
  footer: { marginTop: 22, opacity: 0.65, fontSize: 12 },
  footerLine: { lineHeight: 1.6 },
};
