# SHFantasy v2 Local Artifact Hashes - 2026-07-18

These artifacts were refreshed on the laptop from local git commit `0e8383c align arena around parallel sport tables`.

## Files

- `/tmp/shfantasy-v2-source-baseline-20260718.bundle`
  - Size: 206 KB
  - SHA256: `bec3fd0c9b597819c6ed3e25390f38ec512fb6358ed7bf92fbf5eca55580d703`
- `/tmp/shfantasy-v2-source-baseline-20260718.tar.gz`
  - Size: 176 KB
  - SHA256: `f4fd710ac6b6686896078a6ab5729569477a5acbf86cee9a9de758836a2b4e2e`
- `/tmp/shfantasy-v2-source-baseline-20260718.patch`
  - Size: 834 KB
  - SHA256: `288e97b5c805af3a06d75053c98cf3013a219b883357e89e4206edbaf9435f2b`

## Notes

- The tarball was produced with `git archive` from the committed source tree, so ignored private/runtime files are not included.
- The bundle can recreate the commit history locally with `git clone /tmp/shfantasy-v2-source-baseline-20260718.bundle shfantasy-v2-app-review`.
- These files are local laptop artifacts, not public GitHub downloads.
- The GitHub handoff branch remains documentation-only until a proper GitHub credential/publish lane pushes the actual source branch.
- Product direction now treats sports as parallel SHFantasy tables. Active table means today's best slate, not permanent sport priority.