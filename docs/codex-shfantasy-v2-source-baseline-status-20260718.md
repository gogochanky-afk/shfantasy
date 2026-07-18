# SHFantasy v2 Source Baseline Status - 2026-07-18

Codex has converted the local SHFantasy v2 app into a clean standalone git baseline on the laptop, corrected the product direction to parallel sport tables, added baseball/WWE-style skill fantasy tables, and added private table chip stakes.

## Local Source Baseline

- Local path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Local HEAD commit: `adffa40 add private table chip stakes`
- Prior commit: `5b54787 add skill fantasy baseball and wwe tables`
- Prior commit: `0e8383c align arena around parallel sport tables`
- Baseline commit: `f915f08 baseline shfantasy v2 app`
- Tracked files: 102

## Product Direction Correction

SHFantasy should not frame one sport as permanently primary and another as reserve.

Correct model:

- Daily Blitz is the primary ruleset.
- Football, basketball, golf, baseball, WWE-style sports entertainment, tennis, and future sports are parallel SHFantasy tables.
- The active table for a given day is selected by verified slate quality, event heat, player availability, and roster depth.
- Telegram is a chat/distribution surface, not the main game UI.
- The game should feel like a collectible sports-card arena with strategy, identity, recap, return reasons, cosmetic progression, and private table chip tension.

Codex changed source copy/API packet/tests to remove the old `football default / basketball reserve` framing.

## Private Table Chip Mode

Implemented locally:

- Daily Blitz entry payload now accepts `chip_stake`.
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

A secret scan was run before committing. The only match was a CSS `mask-image` property, not a credential.

## Verification

Backend tests after private chip stakes:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/ -q
```

Result:

```text
45 passed in 1.92s
```

Frontend build:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

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

1. Authenticate the laptop with GitHub CLI, or create a new repo `gogochanky-afk/shfantasy-v2-app`.
2. Push the local branch from `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`.
3. Open a draft PR for architecture, security, game balance, determinism, test coverage, and production-readiness review.
4. Decide after review whether SHFantasy v2 replaces the old production app, becomes a sub-app, or donates specific modules.

## Product Review Focus

- Multi-sport table architecture.
- Private table chip mode and no-cash-value safety boundary.
- Daily Blitz gameplay: up to 5 players, salary cap 10, price tiers 4 / 3 / 2 / 1, captain 1.5x.
- Sport-specific skill reads for football, basketball, golf, baseball, WWE-style sports entertainment, and future sports.
- Player pool quality: daily slate breadth, current team mapping, unavailable player exclusion, and empty data fallback behavior.
- Game feel: mobile-first pick flow, guided first hand, card role clarity, cosmetic collection, return hook, and recap learning loop.
- Skill Parlay: confirm it creates real strategy rather than extra terminology.
- Fairness and compliance: play-money only, no wagering/payment/KYC/cash-value language, no pay-to-win card effects.