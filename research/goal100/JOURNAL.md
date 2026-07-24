# Goal 100 Research Journal

## Cycle 0 - Goal and integrity setup - 2026-07-15

- Objective: research 100% Top-6 Open/Close and 6x6 Jodi coverage for every market.
- Production changes: forbidden.
- Production fingerprint: `d8f09a304bc2eb0a35df2394b850fea0bf932fbb3983196bb53bd3575ba13d8b` across 74 files.
- Baseline data fingerprint: `8674f471f4056ce2c2eb18508952604834f5c1d94577bef11cde7e7d7f1318c3`, 7,287 rows across 12 markets.
- Prediction-set size: fixed at 6 Open digits, 6 Close digits, and 36 Jodis.
- Decision: begin with immutable baseline reproduction and data-leakage audit.
- Production promotion: not allowed under this research goal.

## Cycle 1 - Baseline reproduction and prior-work audit - 2026-07-15

- Production guard passed before and after research actions: 74 files, fingerprint unchanged.
- Exact frozen-cache production replay, 309 last-30-calendar-day draws: Open 251/309 (81.2%), Close 261/309 (84.5%), Jodi 219/309 (70.9%), Adjusted Close 251/309 (81.2%).
- Interpretation: this is a reproduction benchmark, not sealed-forward evidence. The dates have already been searched repeatedly.
- Prior-work audit: Above90, rank-5/6 hybrids, statistical formulas, adaptive experts, joint rectangles, categorical/rolling ML, 48-rule ablation, and Top3/pocket families have already been tested. None supplies a stable 100% challenger.
- Leakage finding: production same-day rules match by date; causal certification requires field-level Open/Close publication timestamps. Several old scripts relied on a market array order that differs from actual event order.
- Protocol decision: use global chronological blocks, nested expanding-origin selection, a 10-minute publication embargo, and treat every historical block as retrospective.
- Forward action: a write-once baseline comparator batch was locally sealed before all market Opens for target date 2026-07-15. It is comparator evidence only; no Goal100 challenger has yet been selected.
- Forward registry seal: `9633b19954f21023f6c37300f9124b1ff1f52fb0c4d8eb3485f36b62393af9a3`.
- Fresh-source limitation: the scraped chart cutoffs ranged from 2026-07-10 through 2026-07-12, so the comparator batch is validly pre-event but uses stale available inputs. This is disclosed, not hidden.
- Current verdict: 100% is not achieved. Continue with a timestamp-censored evaluator and one preregistered candidate; do not mine the old 90% window again.

## Cycle 2 - Nested causal ridge challenger - 2026-07-15

- Research code: `run-nested-ensemble.py`; production imports and writes: none.
- Candidate: per-market ridge digit rankers over a fixed library of rolling frequency, exponential frequency, drought, weekday/month/date, transition, fixed-lag transform, causally earlier same-day market, and known-Open conditional features.
- Contract: exactly six Open, six Close, 36 Cartesian Jodis, and six separately labelled Adjusted Close digits.
- Selection: ridge strength chosen using only the final 30% inner split of development; final weights fit on development only. Validation, holdout, and recent frozen were not used for tuning.
- Development versus production: Open +356 hits, Close +321, Jodi +470. This was treated as selection evidence only.
- Validation versus production: Open +3, Close -52, Jodi -52.
- Holdout versus production: Open -58, Close -49, Jodi -74.
- Recent frozen versus production: Open -127, Close -132, Jodi -191. Paired two-sided p-values were `8.73e-8`, `1.07e-8`, and `4.89e-15` respectively.
- Adjusted Close challenger coverage: 61.8% validation, 59.8% holdout, and 62.4% recent frozen; no causal production comparator was available in the full-block replay.
- Decision: reject. The development lift was unstable and strongly contradicted by later chronology.
- Artifact: `artifacts/nested-causal-ridge-v1.json` (SHA-256 `f7253eae92fe1e20a2bfead131e2683707223a59abf48b64b398a3aabc9808c5`).
- Production guard passed after the cycle with the original 74-file fingerprint unchanged.
- Current verdict: 100% is not achieved. No outcome-history-only family has produced a stable effect remotely close to the target.

## Cycle 3 - Baseline miss-coverage gate - 2026-07-15

- Candidate logic: predict when the production Top-6 will miss, then replace the set with the four excluded digits plus baseline ranks 1-2 while preserving exactly six picks.
- Search: 25 variants per side and 625 Open/Close pairs, selected inside development with per-market Open, Close, and Jodi non-regression constraints.
- Deterministic selection: `baseline-no-gate` for both Open and Close. No active gate passed the development constraint.
- Later blocks: zero ranking changes and zero hit deltas because the valid selected control was the unchanged baseline.
- Decision: reject the miss-gate family; do not force an invalid gate into later evaluation.
- Artifact: `artifacts/coverage-gate-research.json` (SHA-256 `4c543a8a1931434d464e7e6016e60d4b11d37bd75d77f64799d97f674b60a109`).

## Cycle 4 - Causal comparator and completion audit - 2026-07-15

- Exact production and nominal-schedule event-time-censored rankings were compared on 6,558 chronological rows using a ten-minute source embargo and a one-minute pre-Open freeze.
- Ranking changes caused by censoring: zero Open, zero Close, and zero Jodi. The selected production rules are causal under the registered schedule; historical publication delays remain unavailable.
- All-history causal comparator: Open 4,228/6,558 (64.5%), Close 4,332/6,558 (66.1%), Jodi 2,826/6,558 (43.1%).
- Recent-frozen comparator: Open 852/1,222 (69.7%), Close 879/1,222 (71.9%), Jodi 631/1,222 (51.6%).
- A 10,000-replicate circular-shift diagnostic and 2,000-replicate seven-date-block bootstrap were recorded in `artifacts/causal-baseline-summary.json` and `CAUSAL_BASELINE.md`.
- Completion decision: 100% is statistically unsupported for the supplied histories. Further mining of the same rows is not independent evidence; resumption requires genuinely new pre-draw causal inputs or a new sealed cohort.
- Final integrity verification covers fixed set sizes, 6,558-row ledger alignment, artifact hashes, rejected challengers, the 12-entry pending comparator registry, frozen input data, and the unchanged production boundary.
