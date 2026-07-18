# SHFantasy v2 Local Artifact Hashes - 2026-07-18

These artifacts were refreshed on the laptop from local git commit `fefb768 add master ladder ranked progression`.

## Files

- `/tmp/shfantasy-v2-source-baseline-20260718.bundle`
  - Size: 221 KB
  - SHA256: `830856bb80f83dd2984ce8b23afb812b1285cb83dcf0c4fd20bbbc3fe24c98bc`
- `/tmp/shfantasy-v2-source-baseline-20260718.tar.gz`
  - Size: 186 KB
  - SHA256: `2753d0bcf51323de0d7ac5785372efa51082a2dd457e98bfde86c45cbf5bea59`
- `/tmp/shfantasy-v2-source-baseline-20260718.patch`
  - Size: 99 KB
  - SHA256: `82d488b1d0b4e74bdea6db7695fe2b2746dda14bff053fd21236292f3a3c3e56`

## Notes

- The tarball was produced with `git archive` from the committed source tree, so ignored private/runtime files are not included.
- The bundle can recreate the commit history locally with `git clone /tmp/shfantasy-v2-source-baseline-20260718.bundle shfantasy-v2-app-review`.
- The patch contains the source delta from baseline commit `f915f08` through current Master Ladder commit `fefb768`.
- These files are local laptop artifacts, not public GitHub downloads.
- The GitHub handoff branch remains documentation-only until a proper GitHub credential/publish lane pushes the actual source branch.
- Product direction now treats sports as parallel SHFantasy tables. Active table means today's best slate, not permanent sport priority.
- Baseball and WWE-style sports entertainment are implemented in the local source baseline as dry-run skill fantasy tables with tests.
- Private table chip stakes are implemented as game coins only with no cash value, no withdrawals, and no deposit/payment/KYC path.
- Master Ladder ranked progression is implemented locally with RP persistence, promotion/demotion recap packets, a Daily Blitz HUD, and tests ensuring chips do not affect rank.