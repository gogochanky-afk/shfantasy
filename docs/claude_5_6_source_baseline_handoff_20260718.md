# SHFantasy v2 Source Baseline Handoff - 2026-07-18

## Status

This directory is now an isolated local git repository for the current SHFantasy v2 app baseline.

- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Original baseline commit: `f915f08decaeae077183c2ea8d02e9e1442a8224`
- Latest local work now includes multi-sport tables, private table chips, Master Ladder ranked progression, and the second post-review rank settlement hardening pass.
- Tracked files: 100
- Excluded from git: `.env`, API keys, SQLite database, `.venv`, node_modules, Svelte build output, cache folders, and backup archives.
- Third-round clean source shards: `docs/review-patches/shfantasy-master-ladder-0a81171-to-0870ea5/`
- Third-round source-only delta SHA256: `59854f8a1c099fac39a9ce3677363fb1e49cd7cbff061347e62d4ce6ea7c633d`
- Current review status: `docs/shfantasy-master-ladder-review-status-20260718.md`
- 5.6 final source verdict: `APPROVE FOR SOURCE PR`
- Draft PR body prepared at: `docs/shfantasy-v2-source-pr-body-20260718.md`

Direct GitHub push was attempted against `https://github.com/gogochanky-afk/shfantasy.git` and failed only because this laptop does not currently expose an authenticated GitHub git credential to Codex:

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

Codex then installed a temporary GitHub CLI at `/tmp/shfantasy-gh-cli/gh_2.96.0_macOS_arm64/bin/gh` and started the official browser device-login flow. Chrome was signed in as `gogochanky-afk`, but GitHub moved the flow to `Verify Session`, which requires account re-verification that Codex must not guess or bypass.

This is a GitHub account verification blocker, not an app build or source-state blocker.

## Verification

Backend:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/ -q
```

Previous result:

```text
50 passed in 2.39s
```

Current result after the second 5.6 REVise response:

```text
58 passed in 2.25s
```

Frontend:

```bash
cd frontend && npm run build
```

Result:

```text
vite build completed successfully
```

## What To Review

Review this as a standalone source baseline before porting anything into the older production repository.

Priority review areas:

1. Daily Blitz gameplay: up to 5 players, salary cap 10, price tiers 4 / 3 / 2 / 1, captain 1.5x.
2. Multi-sport architecture: football, basketball, golf, tennis, and future sports should be parallel first-class tables; today's active table is selected by slate quality, event heat, availability, and roster depth.
3. Player pool quality: daily slate breadth, current team mapping, unavailable player exclusion, and empty data fallback behavior.
4. Game feel: mobile-first pick flow, guided first hand, card role clarity, cosmetic collection, return hook, and recap learning loop.
5. Skill Parlay: confirm it creates real strategy instead of only terminology.
6. Fairness and compliance: play-money only, no wagering/payment/KYC/cash-value language, no pay-to-win card effects.
7. Master Ladder: confirm Rookie-to-Master RP movement feels competitive without becoming pay-to-win or gambling-like.
8. Production migration: decide whether this app replaces the old SHFantasy repo, becomes a sub-app, or donates only specific modules.

## 5.6 Review Response - Master Ladder Hardening

5.6 reviewed commit `fefb768` as REVise, not production-ready. Codex kept the useful HUD/API packet direction and hardened the competitive state model instead of rewriting the whole game.

What changed:

- `daily_blitz_rank_events` is now the unique settlement ledger; `entry_id` is unique so one entry cannot settle twice.
- `daily_blitz_rank_state` is now the sport-specific current rank source of truth.
- `daily_blitz_entries` stores `ranked_status`, `ranked_attempt_key`, `season_id`, and `rules_version` for audit snapshots.
- A unique attempt key allows one ranked hand per user, sport, slate, season, and rules version; duplicate hands become unranked practice.
- Protected endpoints now use authenticated user identity from request state or the dev `X-SHF-User-ID` header, and reject mismatched body `user_id`.
- `/daily-blitz/ranked/me` returns the authenticated player's full sport ladder plus aggregate Master Profile.
- `/daily-blitz/ranked/{user_id}` is now a safe public profile and does not expose full private rank state.
- `/daily-blitz/entry/{entry_id}/reveal` and `/recap` replay the saved rank event on repeat calls.
- A runtime settlement lock serializes SQLite reveal settlement inside this app process, preventing duplicate concurrent rank events.
- RP movement is based on same-slate percentile, not raw cross-sport score.
- Full-hand / role-diverse bonuses are tiny and cannot turn a negative result into a positive RP gain.
- Frontend API calls send the dev user header automatically.
- Daily Blitz frontend loads `/daily-blitz/ranked/me` for the active sport and avoids flashing Rookie for returning players.
- Reveal responses include `ranked_result.ladder`, `season_id`, `rules_version`, `percentile`, `settled`, and `idempotent_replay`.
- Private chip stake remains explicitly excluded from rank points, scoring, cap, roster legality, and captain multiplier.

Retained from the prior Master Ladder pass:

- `daily_blitz_entries` still keeps `rank_delta`, `rank_points`, and `rank_tier` as entry snapshots.
- `/daily-blitz/slate` exposes `ranked_mode`.
- `/daily-blitz/entry/validate` and `/daily-blitz/entry/submit` expose `rank_preview`.
- `/daily-blitz/entry/{entry_id}/reveal` exposes `ranked_result` with previous points, delta, tier movement, promotion/demotion flags, and recap headline.
- Frontend Daily Blitz now has a compact Master Ladder HUD between deck route and private chips.

Tests now cover:

1. DB schema for rank state, rank events, attempt key, season, and rules version.
2. Auth mismatch and private rank access blocking.
3. Public profile sanitization.
4. Repeat reveal idempotency.
5. Parallel reveal creating exactly one rank event.
6. Duplicate same-slate ranked attempt becoming unranked practice.
7. Sport-separated rank state plus aggregate Master Profile display.
8. Low-result bonuses staying non-positive.

Still worth review:

1. Whether the tier thresholds still feel right once real sports data replaces deterministic mock points.
2. Whether promotion copy should unlock cosmetic-only table badges or profile frames.
3. Whether season soft reset and Diamond/Master inactivity decay should be implemented before public leaderboard launch.
4. Whether same-slate percentile should compare against all legal combos, table entrants only, or a blended field once user volume exists.

## Second 5.6 REVise Response - Source Changes Pending Review

5.6's second source review found three remaining blockers: auth fail-open defaults, multi-instance rank state lost updates, and unfair/unbounded benchmark percentile. Codex has now patched the local source to answer those blockers.

What changed in this second pass:

- Default auth is fail-closed. `X-SHF-User-ID` is ignored unless `SHFANTASY_AUTH_MODE=dev` is explicitly set.
- Production startup now requires `SHFANTASY_AUTH_MODE=session`, so a production deployment cannot silently launch with dev header auth.
- Frontend no longer defaults production players to the shared `hugo` identity.
- Settlement now runs under `BEGIN IMMEDIATE`; reveal state, player scores, rank event, rank state, and entry rank snapshot commit or roll back as one unit.
- `daily_blitz_rank_state` now has a `version` counter and uses atomic RP increment rather than absolute state overwrite.
- `daily_blitz_rank_benchmarks` freezes benchmark distributions by sport, slate, season, rules, benchmark version, and roster size.
- Rank events now store `benchmark_percentile`, `benchmark_version`, and `field_snapshot_id`.
- Ranked benchmark comparison uses the same roster size only.
- Large player pools use deterministic bounded sampling instead of unbounded combination enumeration.
- Entries without `ranked_attempt_key` are treated as `legacy_unranked`/unranked and cannot settle RP.
- Duplicate-attempt handling only catches the ranked attempt-key conflict; unrelated integrity errors fail loudly.
- Tests now cover default auth rejection, production auth guard, independent app/DB concurrent settlement, transaction rollback, legacy entry rank blocking, same-roster benchmark separation, frozen benchmark replay, large pool cap, and non-attempt integrity errors.

Updated proof:

- `docs/live-proof/shfantasy-master-ladder-revise-local-20260718T120011Z.json`

Current deployment stance:

- Source recommendation for reviewer: approved for source PR.
- Deployment recommendation: still block until production auth/session middleware, production payload behavior, benchmark generation, and production migration are confirmed.

## Third 5.6 Source Review Result

5.6 has now reviewed the five 0a81171 to 0870ea5 patch shards and returned:

- Source verdict: `APPROVE FOR SOURCE PR`
- Production merge/deploy: `BLOCKED`
- Documentation handoff branch: do not merge

Approved source baseline areas:

- Auth fail-closed default and production session-mode startup guard.
- Transaction-safe rank settlement with `BEGIN IMMEDIATE`, rollback behavior, atomic rank-state increment, and entry-event idempotency.
- Frozen same-roster benchmark percentile with bounded deterministic sampling.
- Frontend no longer defaults production players to shared `hugo` identity.

Production blockers still outstanding:

1. Real session/JWT middleware.
2. Production frontend payload should omit or null `user_id`, not submit an empty string.
3. Benchmarks should be generated at slate lock, not inside first reveal.
4. Production-grade versioned migration, backup, rollback, and consistency checks.

## Key Files

- `backend/daily_blitz.py`
- `backend/routes/daily_blitz.py`
- `backend/routes/sim.py`
- `backend/main.py`
- `frontend/src/routes/daily-blitz/+page.svelte`
- `frontend/src/routes/arena/+page.svelte`
- `tests/test_daily_blitz.py`
- `tests/test_endpoints.py`
- `docs/shfantasy-daily-blitz-100bot-qa-20260718.md`
- `docs/live-proof/shfantasy-guided-first-hand-local-20260718T094502Z.json`

## Publish Recommendation

Best publish path:

1. Create a new GitHub repository named `gogochanky-afk/shfantasy-v2-app`, or approve pushing this isolated branch to the existing `gogochanky-afk/shfantasy` repo.
2. Authenticate this laptop with GitHub CLI or provide a GitHub app lane that can import local git history.
3. Push the local branch:

```bash
cd /Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app
git push -u origin codex/shfantasy-v2-source-baseline-20260718
```

4. Open a draft PR for review:

```bash
/tmp/shfantasy-gh-cli/gh_2.96.0_macOS_arm64/bin/gh pr create \
  --repo gogochanky-afk/shfantasy \
  --base main \
  --head codex/shfantasy-v2-source-baseline-20260718 \
  --draft \
  --title "SHFantasy v2 source baseline: Daily Blitz + Master Ladder" \
  --body-file docs/shfantasy-v2-source-pr-body-20260718.md
```

Do not merge into production until the deployment owner confirms auth, migration, route/domain, and data-backup readiness.

## Product Direction

Daily Blitz is the primary ruleset. Football, basketball, golf, tennis, and future sports should run as parallel SHFantasy tables; no sport should be framed as permanently more important than another. Telegram is a chat/distribution layer, not the main game UI. The game needs to feel like a collectible sports-card arena with strategy, identity, recap, return reasons, and cosmetic progression. It must not become a generic SaaS dashboard or a betting product.