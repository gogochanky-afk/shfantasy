# SHFantasy v2 Source Baseline Status - 2026-07-18

Codex has converted the local SHFantasy v2 app into a clean standalone git baseline on the laptop and then corrected the product direction to parallel sport tables.

## Local Source Baseline

- Local path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Local HEAD commit: `0e8383c align arena around parallel sport tables`
- Baseline commit: `f915f08 baseline shfantasy v2 app`
- Tracked files: 101

## Product Direction Correction

SHFantasy should not frame one sport as permanently primary and another as reserve.

Correct model:

- Daily Blitz is the primary ruleset.
- Football, basketball, golf, tennis, and future sports are parallel SHFantasy tables.
- The active table for a given day is selected by verified slate quality, event heat, player availability, and roster depth.
- Telegram is a chat/distribution surface, not the main game UI.
- The game should feel like a collectible sports-card arena with strategy, identity, recap, return reasons, and cosmetic progression.

Codex changed source copy/API packet/tests to remove the old `football default / basketball reserve` framing.

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

Backend tests:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/ -q
```

Result after the parallel-sport correction:

```text
40 passed in 1.33s
```

Frontend build:

```bash
cd frontend && npm run build
```

Result: production build completed successfully.

Focused product tests:

```bash
PYTHONPATH=. ./.venv/bin/pytest tests/test_ai_arena.py tests/test_daily_blitz.py tests/test_endpoints.py -q
```

Result:

```text
33 passed in 1.96s
```

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
- Daily Blitz gameplay: up to 5 players, salary cap 10, price tiers 4 / 3 / 2 / 1, captain 1.5x.
- Player pool quality: daily slate breadth, current team mapping, unavailable player exclusion, and empty data fallback behavior.
- Game feel: mobile-first pick flow, guided first hand, card role clarity, cosmetic collection, return hook, and recap learning loop.
- Skill Parlay: confirm it creates real strategy rather than extra terminology.
- Fairness and compliance: play-money only, no wagering/payment/KYC/cash-value language, no pay-to-win card effects.