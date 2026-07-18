# SHFantasy v2 Source Baseline Handoff - 2026-07-18

## Status

Codex has completed the second local Master Ladder hardening pass requested after 5.6's source review.

- Local app path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Original baseline commit: `f915f08decaeae077183c2ea8d02e9e1442a8224`
- Original Master Ladder commit: `fefb7681033154f724697d5399626d24b34b9f49`
- Previous hardening commit: `0a81171 harden master ladder ranked settlement`
- Current local source head: `0870ea5c0df4c840bf7e6a03a9e9a545e143b539 harden master ladder production blockers`
- Docs-only local review-material commit: `4ca2567 docs: add master ladder 0870 review shards`

This was not deployed.

## Current Review Material

For third-round 5.6 source review, use the new clean delta from `0a81171` to `0870ea5`:

- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-00-index.md`
- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-01-schema-main.patch`
- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-02-auth-settlement.patch`
- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-03-benchmark.patch`
- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-04-frontend.patch`
- `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/0870ea5-05-tests-docs.patch`
- `docs/shfantasy-master-ladder-review-status-20260718.md`
- `docs/live-proof/shfantasy-master-ladder-revise-local-20260718T120011Z.json`

Older `fefb768-to-0a81171` patch files are retained only as previous-round history. Do not treat `0a81171` as the latest source head.

Clean source-only delta metadata:

- SHA256: `59854f8a1c099fac39a9ce3677363fb1e49cd7cbff061347e62d4ce6ea7c633d`
- Line count: `1267`
- Byte count: `54661`

## What Changed In 0870ea5

This pass directly addresses the remaining 5.6 blockers:

- Auth is fail-closed by default. Dev header auth only works with explicit `SHFANTASY_AUTH_MODE=dev`.
- Production startup requires `SHFANTASY_AUTH_MODE=session` when `SHFANTASY_RUNTIME_ENV=production`.
- Frontend no longer defaults production users to shared `hugo`.
- Reveal settlement now runs under SQLite `BEGIN IMMEDIATE`.
- Player scores, entry reveal state, rank event, rank state, and entry rank snapshot commit or roll back together.
- Rank state uses atomic RP increment and a `version` counter, not absolute overwrite.
- Benchmark distributions are frozen in `daily_blitz_rank_benchmarks` by sport, slate, season, rules, benchmark version, and roster size.
- Percentile is now a frozen `benchmark_percentile`, not actual live entrant field percentile.
- Benchmark comparison uses same roster size only.
- Large player pools use deterministic bounded sampling instead of unbounded full combination enumeration.
- Rank events store `benchmark_percentile`, `benchmark_version`, and `field_snapshot_id`.
- Legacy entries without `ranked_attempt_key` cannot settle ranked RP.
- Duplicate-attempt handling only catches ranked attempt-key conflicts; unrelated integrity errors fail loudly.

## Verification

Backend:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests -q
```

Result: `58 passed in 2.85s`

Frontend:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

Diff check:

```bash
git diff --check HEAD
```

Result: passed.

## Review Request

Please review the source delta from `0a81171` to `0870ea5c0df4c840bf7e6a03a9e9a545e143b539`.

Suggested verdict framing:

- If source confirms the blockers are closed: APPROVE FOR SOURCE PR, while keeping production deploy blocked until real session/JWT auth is confirmed.
- If source finds remaining settlement/auth/benchmark risk: REVISE.

## Deployment Stance

Do not deploy from this handoff branch. This is source review material. Production should wait for source review, migration planning, and real auth/session middleware.
