# SHFantasy v2 Local Artifact Hashes - 2026-07-18

These artifacts were refreshed on the laptop from local git commit `adffa40 add private table chip stakes`.

## Files

- `/tmp/shfantasy-v2-source-baseline-20260718.bundle`
  - Size: 216 KB
  - SHA256: `eb237859839a2352e23e39514bd25d07b49793855775d75df41e4e6f9d698054`
- `/tmp/shfantasy-v2-source-baseline-20260718.tar.gz`
  - Size: 181 KB
  - SHA256: `4106e612088035dc7b12ba0af8a35fb689a8c5188807c5cb17b0ab62a88d2bbb`
- `/tmp/shfantasy-v2-source-baseline-20260718.patch`
  - Size: 881 KB
  - SHA256: `372cc6b95b37b883700e410a047e0356e9f8a7d7fe30656baf791240217402a2`

## Notes

- The tarball was produced with `git archive` from the committed source tree, so ignored private/runtime files are not included.
- The bundle can recreate the commit history locally with `git clone /tmp/shfantasy-v2-source-baseline-20260718.bundle shfantasy-v2-app-review`.
- These files are local laptop artifacts, not public GitHub downloads.
- The GitHub handoff branch remains documentation-only until a proper GitHub credential/publish lane pushes the actual source branch.
- Product direction now treats sports as parallel SHFantasy tables. Active table means today's best slate, not permanent sport priority.
- Baseball and WWE-style sports entertainment are implemented in the local source baseline as dry-run skill fantasy tables with tests.
- Private table chip stakes are implemented as game coins only with no cash value, no withdrawals, and no deposit/payment/KYC path.