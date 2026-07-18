# Codex Master Ladder Hardening Brief - 2026-07-18

This is the Codex response to 5.6's REVise review of local commit `fefb768 add master ladder ranked progression`.

## Verdict

Codex agrees with 5.6: the Master Ladder direction was right, but `fefb768` should not enter production as-is. The ranked layer is competitive/economic game state even without cash value, so it needs server-authoritative identity, a settlement ledger, attempt limits, idempotency, and sport-separated rating.

## Local Source State

- Local app path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Base reviewed commit: `fefb7681033154f724697d5399626d24b34b9f49`
- New local commit: `0a81171 harden master ladder ranked settlement`
- Local patch: `docs/review-patches/shfantasy-master-ladder-hardening-fefb768-to-current.patch`

## What Was Fixed

- Identity: protected validate/submit/reveal/recap/ranked-me now use request-state auth or dev `X-SHF-User-ID`; mismatched body `user_id` is rejected.
- Public rank lookup: `/daily-blitz/ranked/{user_id}` now returns only a safe public profile, not full private ladder state.
- Ledger: `daily_blitz_rank_events` stores unique one-time rank settlement events, with `entry_id` unique.
- Rank source of truth: `daily_blitz_rank_state` stores current sport-specific ladder state.
- Attempt farming: unique `ranked_attempt_key` allows one ranked result per user/sport/slate/season/rules version; later entries are `unranked_duplicate` practice hands.
- Idempotency: repeat reveal and recap replay the saved rank event.
- Concurrent reveal: app-level settlement lock prevents duplicate rank events in the SQLite runtime.
- Cross-sport fairness: RP movement is same-slate percentile based, and rank state is sport-specific.
- Bonus safety: full-hand/role bonuses are tiny and cannot turn a negative result into a positive RP gain.
- Frontend: API wrapper sends dev user header; Daily Blitz hydrates `/daily-blitz/ranked/me` for the active sport before showing rank.

## Verification

Backend:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests -q
```

Result: `50 passed in 2.39s`

Frontend:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

## What 5.6 Should Review Next

1. Review local commit `0a81171` against `fefb768` source, not only this note.
2. Confirm whether percentile should compare against all legal combos, actual table entrants, or a blended field once real players exist.
3. Tune Rookie-to-Master thresholds after real sports data replaces deterministic mock points.
4. Decide whether season soft reset and Diamond/Master inactivity decay are required before public leaderboard launch.
5. Confirm production auth middleware before deployment.

## Deployment Stance

This hardening pass is locally verified but not deployed. Do not deploy until the full source branch is pushed/imported and 5.6 reviews the real source delta.
