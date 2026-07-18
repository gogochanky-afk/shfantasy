# SHFantasy v2 Source Baseline Status - 2026-07-18

Codex has converted the local SHFantasy v2 app into a clean standalone git baseline on the laptop, corrected the product direction to parallel sport tables, added baseball/WWE-style skill fantasy tables, added private table chip stakes, and now added Master Ladder ranked progression.

## Review Materials For Claude / 5.6

This handoff branch is documentation-only and should not be merged as production code.

5.6 should read these files in order:

1. `docs/codex-shfantasy-v2-source-baseline-status-20260718.md` - current source status and product direction.
2. `docs/review-patches/shfantasy-master-ladder-adffa40-to-fefb768.patch` - actual Master Ladder source delta from `adffa40` to `fefb768`.
3. `docs/claude-5-6-master-ladder-review-brief-20260718.md` - Codex response to 5.6's risk concerns and recommended ranked v2 direction.
4. `docs/codex-shfantasy-v2-local-artifacts-20260718.md` - local artifact hashes for bundle, tarball, and patch.

The full local source branch is still not pushed as a normal GitHub source branch because this laptop lacks an exposed GitHub CLI/HTTPS credential for Codex. The focused source patch is the current review bridge.

## Local Source Baseline

- Local path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Local HEAD commit: `fefb768 add master ladder ranked progression`
- Prior commit: `adffa40 add private table chip stakes`
- Prior commit: `5b54787 add skill fantasy baseball and wwe tables`
- Prior commit: `0e8383c align arena around parallel sport tables`
- Baseline commit: `f915f08 baseline shfantasy v2 app`
- Tracked files: 102+

## Product Direction Correction

SHFantasy should not frame one sport as permanently primary and another as reserve.

Correct model:

- Daily Blitz is the primary ruleset.
- Football, basketball, golf, baseball, WWE-style sports entertainment, tennis, and future sports are parallel SHFantasy tables.
- The active table for a given day is selected by verified slate quality, event heat, player availability, and roster depth.
- Telegram is a chat/distribution surface, not the main game UI.
- The game should feel like a collectible sports-card arena with strategy, identity, recap, return reasons, cosmetic progression, private table chip tension, and ranked climb pressure.

Codex changed source copy/API packet/tests to remove the old `football default / basketball reserve` framing.

## Master Ladder Ranked Mode

Implemented locally in commit `fefb768`:

- Added Rookie, Bronze, Silver, Gold, Platinum, Diamond, and Master tiers.
- Daily Blitz entries now persist `rank_delta`, `rank_points`, and `rank_tier`.
- `/daily-blitz/slate` exposes `ranked_mode`.
- `/daily-blitz/ranked/{user_id}` exposes current player ladder state.
- `/daily-blitz/entry/validate` and `/daily-blitz/entry/submit` expose `rank_preview`.
- `/daily-blitz/entry/{entry_id}/reveal` exposes `ranked_result` with previous points, RP delta, tier movement, promotion/demotion flags, and recap headline.
- Frontend Daily Blitz now shows a compact Master Ladder HUD between deck route and private chips.

Rank safety boundary:

- Rank points are competitive game progress only.
- Private chip stake does not affect rank points, fantasy score, salary cap, roster legality, or captain multiplier.
- Skins do not affect scoring power.
- Ranks have no cash value and cannot be bought.

## Private Table Chip Mode

Implemented locally:

- Daily Blitz entry payload accepts `chip_stake`.
- Allowed stakes: `0`, `5`, `10`, `20`, `50` table chips.
- Invalid stakes return `invalid_chip_stake` and block submit.
- Entries store `chip_stake` and recap stores `chip_delta`.
- Recap returns `chip_result`:
  - A/S score: win the stake as table chips.
  - B score: stake returned.
  - C score: stake lost as table chips.
- UI shows a private chip selector on the Daily Blitz roster board.

Safety boundary:

- Table chips are private game coins only.
- No cash value.
- No withdrawals.
- No deposits.
- No payment/KYC/broker path.
- No public gambling positioning.

## Skill Fantasy Expansion

Implemented locally:

- Baseball mock Daily Blitz slate with pitcher ceiling, lineup slot, on-base bridge, power, speed, and lineup scratch handling.
- WWE-style mock Daily Blitz slate with main-event aura, crowd swing, promo control, match-card leverage, upset reads, and pulled-match handling.
- `skill_fantasy_rules` packet inspired by Polymarket-style resolution clarity and DraftKings-style roster/cap tension, without copying real-money gambling mechanics.
- AI scout roster recommendation now prefers legal full hands and sport-aware captain priority instead of greedily taking two expensive stars.
- Frontend table selectors now show football, basketball, baseball, and WWE-style tables as first-class lanes.

## Safety

Excluded from git:

- `.env` and `.env.*`
- API keys and tokens
- `data/*.sqlite` and database files
- `.venv`
- `frontend/node_modules`
- Svelte build output
- cache folders
- local backup archives

A secret scan was run before committing the baseline. The only match was a CSS `mask-image` property, not a credential.

## Verification

Backend tests after Master Ladder:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/ -q
```

Result:

```text
46 passed in 2.03s
```

Frontend build:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

Local proof artifact:

- `docs/live-proof/shfantasy-master-ladder-local-20260718T104203Z.json`

## Why The Full Source Is Not On GitHub Yet

A direct push was attempted to:

```text
https://github.com/gogochanky-afk/shfantasy.git
```

It failed because this laptop does not expose GitHub CLI or HTTPS git credentials to Codex:

```text
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

This is a publish credential blocker only. The local source baseline itself is committed and verified.

## Recommended Next Step For Claude / 5.6

Do not merge this handoff branch. It remains documentation-only.

Best path:

1. Read the focused Master Ladder patch and review brief on this handoff branch.
2. Authenticate the laptop with GitHub CLI, or create a new repo `gogochanky-afk/shfantasy-v2-app`.
3. Push the local branch from `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`.
4. Open a draft PR for architecture, security, game balance, determinism, test coverage, and production-readiness review.
5. Have 5.6 review Master Ladder RP tuning, promotion rewards, seasonal resets, sport/table segmentation, and whether the HUD feels game-native.
6. Decide after review whether SHFantasy v2 replaces the old production app, becomes a sub-app, or donates specific modules.

## Product Review Focus

- Multi-sport table architecture.
- Master Ladder ranked progression and no-pay-to-win competitive pressure.
- Private table chip mode and no-cash-value safety boundary.
- Daily Blitz gameplay: up to 5 players, salary cap 10, price tiers 4 / 3 / 2 / 1, captain 1.5x.
- Sport-specific skill reads for football, basketball, golf, baseball, WWE-style sports entertainment, and future sports.
- Player pool quality: daily slate breadth, current team mapping, unavailable player exclusion, and empty data fallback behavior.
- Game feel: mobile-first pick flow, guided first hand, card role clarity, cosmetic collection, return hook, and recap learning loop.
- Skill Parlay: confirm it creates real strategy rather than extra terminology.
- Fairness and compliance: play-money only, no wagering/payment/KYC/cash-value language, no pay-to-win card effects.