# Summary

This draft PR publishes the isolated SHFantasy v2 source baseline for code review.

The baseline includes Daily Blitz, multi-sport fantasy tables, cosmetic/private table concepts, guided first hand, 100-bot local playtest proof, and the hardened Master Ladder ranked settlement model approved by 5.6 for source PR review.

# Review Status

- 5.6 source verdict: APPROVE FOR SOURCE PR.
- Production merge/deploy: BLOCKED.
- Handoff patch branch: do not merge.

# What Changed

- Adds the standalone SHFantasy v2 app source baseline.
- Keeps tracked source separate from `.env`, API keys, SQLite DB files, virtualenvs, node_modules, build output, caches, and backups.
- Hardens Master Ladder with fail-closed auth defaults, transaction-safe rank settlement, unique ranked attempts, sport-separated rank state, frozen same-roster benchmark percentiles, and legacy-entry rank blocking.
- Adds regression coverage for auth defaults, production auth guard, independent DB connection concurrency, rollback, duplicate ranked attempts, legacy entries, benchmark freezing, large pool caps, and non-attempt integrity errors.

# Verification

- Backend tests: `58 passed`.
- Frontend production build: passed.
- Diff whitespace check: passed.

# Production Blockers Before Merge/Deploy

- Add and verify real session/JWT middleware.
- Ensure production frontend submit/validate payloads omit `user_id` or send `null`, never an empty string identity.
- Pre-generate frozen benchmarks at slate lock instead of doing first-generate work inside reveal settlement.
- Replace prototype `_ensure_column()` migration behavior with versioned production migration, backup, rollback, and consistency checks.

# Notes For Reviewers

Review this as a source baseline, not a production deployment request. The goal is to decide how SHFantasy v2 should become the canonical product path without accidentally merging an unreviewed replacement into the older production repository.