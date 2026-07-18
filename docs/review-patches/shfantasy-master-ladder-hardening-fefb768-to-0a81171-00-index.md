# SHFantasy Master Ladder Hardening Patch Index

This is the source-review index for the local patch from:

- Base: `fefb7681033154f724697d5399626d24b34b9f49` (`add master ladder ranked progression`)
- Head: `0a81171 harden master ladder ranked settlement`

Local canonical patch:

```text
/Users/chankoonyuk/Documents/Codex/apps/shfantasy-v2-app/docs/review-patches/shfantasy-master-ladder-hardening-fefb768-to-current.patch
```

Full patch SHA256:

```text
da2b3bd3d76c3aece9d8dc9b72eb4c726d1a757c01d94bf67904ea43637566b2
```

Patch line count: `1381`
Patch byte count: `63919`

Review parts generated from the same local diff:

1. `01-schema-main.patch`
   - Scope: `README.md`, `backend/db.py`, `backend/main.py`
   - Lines: `118`
   - SHA256: `1825008dd4ecb6e4ebe3de605fe62e7ab74efc80eb5eae274d4e529dee1ed733`

2. `02-daily-blitz-route-a.patch`
   - Scope: `backend/routes/daily_blitz.py`, part 1 of 3
   - Lines: `260`
   - SHA256: `2ef503042cb716c898c7eaad55c33fb4814815a70a4632fdded1c56a4192b35f`

3. `03-daily-blitz-route-b.patch`
   - Scope: `backend/routes/daily_blitz.py`, part 2 of 3
   - Lines: `260`
   - SHA256: `66c117bdb98ce165841e116e9a93ad7000695d15e1f7035c21a0668cac8d03c9`

4. `04-daily-blitz-route-c.patch`
   - Scope: `backend/routes/daily_blitz.py`, part 3 of 3
   - Lines: `75`
   - SHA256: `2e167cdebb0f1377a2091503de1b876b54c8ff7f54ca023cbfe722e9187ae979`

5. `05-frontend.patch`
   - Scope: `frontend/src/lib/api.ts`, `frontend/src/routes/daily-blitz/+page.svelte`
   - Lines: `156`
   - SHA256: `2f8cca4279adba93ef6c462544c19fa385b09d2c3f0b7607fcbe9731e3bbb82b`

6. `06-tests-docs.patch`
   - Scope: `tests/test_daily_blitz.py`, handoff/proof/docs updates
   - Lines: `512`
   - SHA256: `995c79ee20a97a98240c4bc7e8bda9fe707744a742eb702d366fbc114d2dfc75`

5.6 review priority:

1. Confirm `X-SHF-User-ID` is dev-only and production must use real auth middleware.
2. Confirm ledger/idempotency relies on DB uniqueness, not only app-level lock.
3. Confirm same-slate percentile field is versioned and settlement does not recalculate after reveal.
4. Confirm duplicate ranked attempts are practice-only and cannot farm RP.
5. Confirm frontend rank hydration uses `/daily-blitz/ranked/me` and does not trust public lookup.

Deployment stance: REVIEW PENDING. Do not deploy until the actual source patch is reviewed.
