# SHFantasy v2 Source Baseline Status - 2026-07-18

Codex has converted the local SHFantasy v2 app into a clean standalone git baseline on the laptop. The newest local source commit is now `0a81171 harden master ladder ranked settlement`, built directly on top of `fefb768 add master ladder ranked progression` after 5.6 reviewed that prior commit as REVise.

This handoff branch is documentation-only and should not be merged as production code.

## Review Materials For Claude / 5.6

Read these files in order:

1. `docs/codex-shfantasy-v2-source-baseline-status-20260718.md` - current source status and product direction.
2. `docs/claude-5-6-master-ladder-review-brief-20260718.md` - earlier review brief and ranked v2 concerns.
3. `docs/live-proof/shfantasy-master-ladder-hardening-local-20260718T112115Z.json` - latest local proof for the hardening pass.
4. `docs/codex-shfantasy-v2-local-artifacts-20260718.md` - older artifact hashes for bundle/tarball/patch.
5. `docs/review-patches/shfantasy-master-ladder-adffa40-to-fefb768.patch` - previous Master Ladder v1 source delta.

Important: the latest hardening source patch exists locally at:

```text
/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app/docs/review-patches/shfantasy-master-ladder-hardening-fefb768-to-current.patch
```

The full local source branch still is not pushed as a normal GitHub source branch because this laptop lacks an exposed GitHub CLI/HTTPS credential for Codex. GitHub now has the latest status/proof, while the canonical source remains the local git commit.

## Local Source Baseline

- Local path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Local HEAD commit: `0a81171 harden master ladder ranked settlement`
- Prior commit: `fefb768 add master ladder ranked progression`
- Prior commit: `adffa40 add private table chip stakes`
- Prior commit: `5b54787 add skill fantasy baseball and wwe tables`
- Prior commit: `0e8383c align arena around parallel sport tables`
- Baseline commit: `f915f08 baseline shfantasy v2 app`

## Product Direction

SHFantasy should not frame one sport as permanently primary and another as reserve.

Correct model:

- Daily Blitz is the primary ruleset.
- Football, basketball, golf, baseball, WWE-style sports entertainment, tennis, and future sports are parallel SHFantasy tables.
- The active table for a given day is selected by verified slate quality, event heat, player availability, and roster depth.
- Telegram is a chat/distribution surface, not the main game UI.
- The game should feel like a collectible sports-card arena with strategy, identity, recap, return reasons, cosmetic progression, private table chip tension, and ranked climb pressure.

## Master Ladder Hardening In `0a81171`

5.6 correctly identified that the `fefb768` Master Ladder scaffold needed production hardening before deployment. Codex kept the useful game/UI direction and fixed the competitive state model.

Implemented locally:

- Added `daily_blitz_rank_events` as a unique settlement ledger with `entry_id` uniqueness.
- Added `daily_blitz_rank_state` as the sport-specific rank source of truth.
- Added entry snapshots: `ranked_status`, `ranked_attempt_key`, `season_id`, and `rules_version`.
- Enforced one ranked settlement per user, sport, slate, season, and rules version.
- Converted duplicate same-slate entries into unranked practice hands that can reveal lessons but cannot earn RP.
- Changed RP from raw score to same-slate percentile.
- Kept five-card and role-diverse bonuses tiny, and blocked them from turning a negative result into a positive RP gain.
- Added authenticated user handling through request state or dev `X-SHF-User-ID` header.
- Rejected body `user_id` mismatches and blocked users from revealing other users' entries.
- Added `/daily-blitz/ranked/me` for authenticated full rank state.
- Changed `/daily-blitz/ranked/{user_id}` into a public-safe profile that does not expose full private rank state.
- Added reveal idempotency through saved rank events.
- Added a SQLite runtime settlement lock to prevent duplicate concurrent rank events inside this app process.
- Updated frontend API calls to send `X-SHF-User-ID` from localStorage.
- Updated Daily Blitz frontend to hydrate active sport rank on load and avoid returning-player Rookie flash.

## Test Coverage Added/Updated

Latest tests cover:

- DB schema for rank state, rank events, attempt key, season, and rules version.
- Auth mismatch and private rank access blocking.
- Public profile sanitization.
- Repeat reveal idempotency.
- Parallel reveal creating exactly one rank event.
- Duplicate same-slate ranked attempt becoming unranked practice.
- Sport-separated rank state plus aggregate Master Profile display.
- Low-result bonuses staying non-positive.

## Verification

Backend tests:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests -q
```

Result:

```text
50 passed in 2.39s
```

Frontend build:

```bash
cd frontend && npm run build
```

Result:

```text
vite build completed successfully
```

Latest local proof artifact:

- `docs/live-proof/shfantasy-master-ladder-hardening-local-20260718T112115Z.json`

## Still Not Deployed

This is local source work and GitHub handoff documentation, not production deployment.

Do not route this to production until:

1. The full source branch is pushed or imported into a proper GitHub review branch/repo.
2. 5.6 reviews `0a81171` source, not just this status note.
3. Deployment owner confirms auth middleware and migration path.
4. Public leaderboard policy is confirmed.
5. Real sports-data API integration is approved after dry-run gameplay remains stable.

## Recommended Next Step For Claude / 5.6

Best path:

1. Review local commit `0a81171` against `fefb768` on the laptop, or import/push the local branch into `gogochanky-afk/shfantasy-v2-app`.
2. Confirm the rank ledger, identity, attempt policy, percentile formula, and frontend rank hydration.
3. Decide whether season soft reset and Diamond/Master inactivity decay must land before public leaderboard.
4. Then open a production migration PR. Do not merge this documentation-only handoff branch.