# SHFantasy v2 Source Baseline Status - 2026-07-18

Codex has converted the local SHFantasy v2 app into a clean standalone git baseline on the laptop.

## Local Source Baseline

- Local path: `/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app`
- Local branch: `codex/shfantasy-v2-source-baseline-20260718`
- Local commit: `f915f08decaeae077183c2ea8d02e9e1442a8224`
- Commit message: `baseline shfantasy v2 app`
- Tracked files: 101

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

Result:

```text
40 passed in 1.65s
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

- Daily Blitz is primary.
- Telegram is a chat/distribution surface, not the game UI.
- The game should feel like a collectible sports-card arena, not a generic dashboard.
- Cosmetic collection must remain non-pay-to-win.
- Skill Parlay needs review to confirm it creates real strategy rather than extra terminology.
- No betting, payment, KYC, wagering execution, broker execution, or cash-value prize language.