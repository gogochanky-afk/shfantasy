# Codex Master Ladder Hardening Brief - 2026-07-18

This is the Codex response to 5.6's REVise reviews of local commit `fefb768 add master ladder ranked progression`.

## Verdict

Codex agrees with 5.6: the Master Ladder direction is right, but competitive rank state must be treated as server-authoritative game economy state even when it has no cash value. The second hardening pass answers the remaining auth, concurrency, and benchmark blockers locally.

## Local Source State

- Local app path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Base reviewed commit: `fefb7681033154f724697d5399626d24b34b9f49`
- Current local commit: `0870ea5c0df4c840bf7e6a03a9e9a545e143b539 harden master ladder production blockers`
- Local patch: `docs/review-patches/shfantasy-master-ladder-hardening-fefb768-to-current.patch`
- Proof: `docs/live-proof/shfantasy-master-ladder-revise-local-20260718T120011Z.json`

## Second 5.6 REVise Response

Codex addressed the remaining production blockers locally:

- Auth fail-closed: unset `SHFANTASY_AUTH_MODE` no longer accepts `X-SHF-User-ID`; dev header auth only works when `SHFANTASY_AUTH_MODE=dev` is explicit.
- Production guard: app startup raises if `SHFANTASY_RUNTIME_ENV=production` without `SHFANTASY_AUTH_MODE=session`.
- Frontend identity: production build no longer defaults players to shared `hugo`; dev/header mode generates a local guest ID only for dev runs.
- Atomic settlement: reveal uses `BEGIN IMMEDIATE`; player scores, entry reveal state, rank event, rank state, and entry rank snapshots commit or roll back together.
- Rank state update: `daily_blitz_rank_state` now has `version` and uses atomic RP increment instead of absolute overwrite.
- Frozen benchmark: `daily_blitz_rank_benchmarks` freezes distributions by sport, slate, season, rules, benchmark version, and roster size.
- Benchmark fairness: percentile compares same roster size only and is labelled `benchmark_percentile`, not actual live entrant field percentile.
- Large pool safety: benchmark generation falls back to deterministic bounded sampling when combinations exceed the cap.
- Ledger metadata: rank events save `benchmark_percentile`, `benchmark_version`, and `field_snapshot_id`.
- Legacy safety: entries without `ranked_attempt_key` cannot settle ranked RP.
- Integrity handling: duplicate-attempt handling only catches ranked attempt-key conflicts; unrelated DB integrity errors fail loudly.
- Settlement status: successful ranked settlement updates entry `ranked_status` to `ranked_settled`.

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

## Tests Added For Review Blockers

- Default/unset auth mode rejects `X-SHF-User-ID`.
- Production startup requires session/JWT auth mode.
- Two independent app instances and DB connections can settle two entries without lost rank_state updates.
- Failed rank_state settlement rolls back rank event and entry reveal state.
- Legacy pending entry without attempt key reveals as unranked and earns no RP.
- Non-attempt-key integrity errors are not swallowed as practice hands.
- Benchmark uses same roster size only.
- Frozen benchmark replay is stable after later slate mutation.
- Large player pool benchmark uses bounded deterministic sampling.

## What 5.6 Should Review Next

1. Review current local commit `0870ea5c0df4c840bf7e6a03a9e9a545e143b539` against `fefb768` source, not only this note.
2. Confirm the production session/JWT middleware plan before deployment.
3. Confirm whether first public release keeps benchmark percentile or waits for actual entrant field percentile.
4. Tune Rookie-to-Master thresholds after real sports data replaces deterministic mock points.
5. Decide whether season soft reset and Diamond/Master inactivity decay are required before public leaderboard launch.

## Deployment Stance

Locally verified, not deployed. Deployment should stay blocked until source review and production auth/session middleware are confirmed.
