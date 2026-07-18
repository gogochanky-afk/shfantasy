# SHFantasy v2 Local Artifact Hashes - 2026-07-18

These artifacts were refreshed on the laptop from local git commit `5b54787 add skill fantasy baseball and wwe tables`.

## Files

- `/tmp/shfantasy-v2-source-baseline-20260718.bundle`
  - Size: 212 KB
  - SHA256: `693b01a6f3f455ab390c9403439be91c821f3224a0d4020986acb9f0e690c77a`
- `/tmp/shfantasy-v2-source-baseline-20260718.tar.gz`
  - Size: 179 KB
  - SHA256: `53843818d4536158e171c15982f92ce5a624397ab0076ba7ddfe06412f33c587`
- `/tmp/shfantasy-v2-source-baseline-20260718.patch`
  - Size: 862 KB
  - SHA256: `963f4da721dfb0d8959f4f86a86114540bdd76ab00d1f4c0fd99d4ca5bfd1daf`

## Notes

- The tarball was produced with `git archive` from the committed source tree, so ignored private/runtime files are not included.
- The bundle can recreate the commit history locally with `git clone /tmp/shfantasy-v2-source-baseline-20260718.bundle shfantasy-v2-app-review`.
- These files are local laptop artifacts, not public GitHub downloads.
- The GitHub handoff branch remains documentation-only until a proper GitHub credential/publish lane pushes the actual source branch.
- Product direction now treats sports as parallel SHFantasy tables. Active table means today's best slate, not permanent sport priority.
- Baseball and WWE-style sports entertainment are now implemented in the local source baseline as dry-run skill fantasy tables with tests.