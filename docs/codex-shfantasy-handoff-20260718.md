# Codex SHFantasy Handoff - 2026-07-18

This branch is a coordination handoff for the SHFantasy work currently developed in the owner laptop Codex workspace.

## Why This Handoff Exists

The local working app path is:

`/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`

That local folder is not currently a git checkout. The GitHub repository `gogochanky-afk/shfantasy` is readable, but the expected local path `backend/routes/daily_blitz.py` was not found on `main` through the GitHub contents API. Because of that, Codex should not blindly overwrite GitHub `main` with local files until the real repository mapping is confirmed.

## Local Product Passes Completed

### 1. Daily Blitz 100-Bot QA

- Added Daily Blitz-specific bot swarm routes under `/sim/bots/daily-blitz/*`.
- Added 100-bot validation for roster legality, full five-card hands, salary cap, duplicate prevention, and unavailable-player exclusion.
- Result: 100/100 legal, 100/100 full hands, 0 skipped.

### 2. 8+ Card Slate And Captain Identity

- Expanded football mock slate to 9 playable cards plus 1 blocked unavailable card.
- Added card identity fields:
  - `tier_label`
  - `card_role`
  - `captain_identity`
  - `combo_hint`
  - `card_frame`
- Captain identities:
  - Safe Captain
  - Ceiling Captain
  - Control Captain
  - Value Captain
  - Chaos Captain

### 3. Cosmetic Collection + Skill Parlay

- Added cosmetic skin packets for every card.
- Skins are LoL-style cosmetic only: reveal frames, rarity, set, upgrade path, recap identity.
- Skins do not improve fantasy points, salary cap, captain multiplier, or roster legality.
- Added Skill Parlay Chain packets on validate, submit, and recap.
- Parlay rewards style XP, collection progress, and recap titles only.
- `cash_value` is always `none`.

### 4. Guided First Hand

- Added three backend-validated starter routes:
  - Safe Table
  - Ceiling Hunt
  - Value Heist
- Each route returns legal `player_ids`, `captain_player_id`, `parlay_chain`, and `reward_preview`.
- Frontend `/daily-blitz` has one-click route loading into the roster board.

## Local Verification

- Backend tests: `40 passed`
- Frontend production build: passed
- 100-bot swarm: 100/100 legal full hands

Latest local release package:

`/tmp/shfantasy-v2-do-release-20260718T094502Z.tar.gz`

SHA256:

`c088b4ebbc3aca522cb8a0ba657a25c8aade7d52721a9473ba4d2d203aa649e7`

## Local Proof Files

- `docs/live-proof/shfantasy-daily-blitz-100bot-local-20260718T055127Z.json`
- `docs/live-proof/shfantasy-daily-blitz-8card-captain-local-20260718T071203Z.json`
- `docs/live-proof/shfantasy-cosmetic-parlay-local-20260718T072136Z.json`
- `docs/live-proof/shfantasy-guided-first-hand-local-20260718T094502Z.json`

These paths exist in the local Codex workspace, not necessarily in this GitHub repository yet.

## Required Next Step For 5.6 / Claude

Before porting code, confirm the real production repository layout for SHFantasy.

Check whether the production implementation lives under one of these paths or another path:

- `backend/routes/daily_blitz.py`
- `apps/shfantasy-v2-app/backend/routes/daily_blitz.py`
- `server/routes/daily_blitz.py`
- `src/routes/daily-blitz`
- another app root entirely

Once the path mapping is confirmed, port these local changes in order:

1. Daily Blitz card pool and card identity packet.
2. Cosmetic skin and collection packet.
3. Skill Parlay packet on validate, submit, and recap.
4. Guided First Hand packet and one-click UI loading.
5. Regression tests and 100-bot proof.

## Guardrails

- Do not merge this branch as a production feature branch by itself. It is a coordination/handoff branch only.
- Do not overwrite `main` until real file mapping is confirmed.
- Do not add paid API or real-money wagering features.
- Do not use Telegram public SHFantasy group for internal proof.
- Keep all gameplay play-money only until legal/product review.
