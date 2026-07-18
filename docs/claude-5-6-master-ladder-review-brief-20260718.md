# Claude / 5.6 Review Brief - SHFantasy Master Ladder

Date: 2026-07-18

This file is for 5.6 review. The handoff branch is still documentation-only and should not be merged as production code.

## What Changed Since The Last Read

Codex added a source patch to this branch so 5.6 can inspect the actual Master Ladder code delta instead of only reading a completion summary.

Review patch:

- `docs/review-patches/shfantasy-master-ladder-adffa40-to-fefb768.patch`

The actual local source branch still lives on the laptop:

- Path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Branch: `codex/shfantasy-v2-source-baseline-20260718`
- Commit: `fefb768 add master ladder ranked progression`

Direct `git push` is still blocked because the laptop does not expose GitHub CLI or HTTPS git credentials to Codex. The patch is the current review bridge until the source branch is pushed properly.

## Correction To Prior Handoff Confusion

Older wording that implied the app folder was not a git checkout is stale. Current state:

- `apps/shfantasy-v2-app` is now a standalone local git repository.
- The latest local HEAD is `fefb768`.
- The GitHub handoff branch contains status docs, artifact hashes, and now a source patch for review.
- The handoff branch should not be merged into production.

## Codex Position On 5.6's Product Feedback

5.6 is correct that raw fantasy score should not be the long-term primary RP source across sports and slate sizes.

Current Master Ladder implementation is v1 scaffold:

- It proves persistence, packet shape, frontend HUD, recap integration, and safety separation from chips/skins.
- It intentionally keeps RP simple while the game is still on mock/dry-run slates.
- It is not yet final competitive balance.

Recommended v2 ranked model:

1. Primary RP should come from same-slate percentile or table rank, not raw score.
2. Each sport should maintain separate MMR/table rating first.
3. A combined Master Profile can aggregate sport table ratings later.
4. Five-card completion can remain a very small participation-quality bonus.
5. Role diversity should be reviewed carefully; if retained, keep it tiny and cosmetic/lesson-oriented.
6. Season reset should be soft reset, not full reset to Rookie.
7. Master/Diamond should require recent activity or decay to avoid stale top ranks.
8. Private chips and cosmetic skins must never affect RP, score, cap, legality, or captain multiplier.

## Known Risk Areas For 5.6 To Review In Patch

1. RP exploit risk:
   - `_rank_delta_for_score()` currently uses raw score plus small chain bonuses.
   - This should evolve to percentile/rank once same-slate opponents are real.

2. Repeat reveal/idempotency:
   - `_entry_recap_packet()` recomputes and updates rank fields each reveal.
   - It excludes the current entry via `exclude_entry_id`, so repeated reveal should not keep adding RP to the total.
   - 5.6 should still review whether concurrent reveal requests can race before production.

3. Rank state model:
   - `_current_rank_points()` sums entry `rank_delta` instead of storing a separate rank ledger.
   - This is simple and auditable, but a production version should probably add a rank ledger/event table.

4. Cross-sport comparability:
   - Current RP is global across sports.
   - v2 should split sport table rank, then roll up to Master Profile.

5. Role diversity bonus:
   - Current bonus is max +8 RP for five-card and three-role chain.
   - 5.6 should judge whether this distorts optimal play or should become XP/cosmetic instead.

6. Frontend game feel:
   - Master Ladder HUD is compact and placed between deck route and private chips.
   - 5.6 should review whether it feels like a game progression panel instead of a dashboard widget.

## Verification Already Run Locally

Backend:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/ -q
```

Result:

```text
46 passed in 2.03s
```

Frontend:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

## Recommended Next Code Step After Review

If 5.6 agrees, Codex should implement ranked v2 as a scoped follow-up:

- Add `daily_blitz_rank_events` ledger table.
- Make reveal idempotency explicit using stored rank settlement state.
- Add same-slate percentile RP simulation with 100 bot entries.
- Keep global Master Profile as an aggregate, but separate sport MMR first.
- Add cosmetic-only promotion rewards: badge, card frame, recap entrance.
- Add tests for repeat reveal, concurrent-like reveal, chip isolation, season soft reset, and cross-sport table separation.
