# SHFantasy v2 Source Baseline Handoff - 2026-07-18

## Status

Codex has completed a second local hardening pass for SHFantasy v2 Master Ladder after 5.6's source review.

- Local app path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Base reviewed commit: `fefb7681033154f724697d5399626d24b34b9f49`
- Latest local commit: `0870ea5c0df4c840bf7e6a03a9e9a545e143b539 harden master ladder production blockers`
- Handoff branch status docs were updated through GitHub connector.
- Full local patch: `docs/review-patches/shfantasy-master-ladder-hardening-fefb768-to-current.patch`
- Full local patch SHA256: `d2073c34eb1f566985414b1956fff3160146f03f4e49c6da79084a23db46b380`
- Patch length: 3483 lines / about 155 KB.

This was not deployed.

## What Changed

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

## New Tests Worth Reviewing

- default auth rejection of `X-SHF-User-ID`
- production startup auth guard
- two independent app/DB connections settling without lost rank_state update
- failed rank_state update rolling back event and entry reveal state
- legacy pending entry with null attempt key earning no RP
- non-attempt-key integrity error not swallowed as duplicate practice
- same-roster benchmark separation
- frozen benchmark replay after later slate mutation
- large player pool deterministic sample cap

## Review Request

Please review the source delta from `fefb768` to local commit `0870ea5c0df4c840bf7e6a03a9e9a545e143b539`.

Recommended verdict target:

- If source confirms the above: APPROVE FOR SOURCE PR, still block production deploy until session/JWT auth middleware is confirmed.
- If source finds remaining settlement/auth/benchmark issue: REVISE.

## Deployment Stance

Do not deploy from this handoff branch. This is source review material. Production should wait for source review, migration plan, and real auth/session middleware.

