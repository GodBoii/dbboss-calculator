# Goal100 Coverage-State Gate Research

Generated: 2026-07-14T22:54:55.822440+00:00

## Frozen design

A gate predicts whether the baseline Top-6 will miss. When active, it emits the four baseline-excluded digits plus baseline ranks 1-2, preserving exactly six distinct digits. Features contain only market/calendar state, the current causal baseline ranking, completed own-market lags, and trailing baseline hit history.

Inner development searched 25 variants per side and 625 Open/Close pairs. Selection required non-regression for Open, Close, and Jodi in every market inside the development-selection fold. Validation, holdout, and recent-frozen results did not select or modify the pair.

Open selection: `baseline-no-gate`

Close selection: `baseline-no-gate`

## Aggregate

| Block | Open | Close | Jodi |
| --- | --- | --- | --- |
| development | 1854/2929 (63.3%) -> 1854/2929 (63.3%), delta +0, gates 0 | 1876/2929 (64.0%) -> 1876/2929 (64.0%), delta +0, gates 0 | 1183/2929 (40.4%) -> 1183/2929 (40.4%), delta +0, gates 0 |
| validation | 715/1174 (60.9%) -> 715/1174 (60.9%), delta +0, gates 0 | 787/1174 (67.0%) -> 787/1174 (67.0%), delta +0, gates 0 | 492/1174 (41.9%) -> 492/1174 (41.9%), delta +0, gates 0 |
| holdout | 807/1233 (65.5%) -> 807/1233 (65.5%), delta +0, gates 0 | 790/1233 (64.1%) -> 790/1233 (64.1%), delta +0, gates 0 | 520/1233 (42.2%) -> 520/1233 (42.2%), delta +0, gates 0 |
| recentFrozen | 852/1222 (69.7%) -> 852/1222 (69.7%), delta +0, gates 0 | 879/1222 (71.9%) -> 879/1222 (71.9%), delta +0, gates 0 | 631/1222 (51.6%) -> 631/1222 (51.6%), delta +0, gates 0 |

## Later-block market deltas

| Market | Block | Open delta | Close delta | Jodi delta |
| --- | --- | ---: | ---: | ---: |
| Sridevi | validation | +0 | +0 | +0 |
| Sridevi | holdout | +0 | +0 | +0 |
| Sridevi | recentFrozen | +0 | +0 | +0 |
| Time Bazar | validation | +0 | +0 | +0 |
| Time Bazar | holdout | +0 | +0 | +0 |
| Time Bazar | recentFrozen | +0 | +0 | +0 |
| Madhur Day | validation | +0 | +0 | +0 |
| Madhur Day | holdout | +0 | +0 | +0 |
| Madhur Day | recentFrozen | +0 | +0 | +0 |
| Milan Day | validation | +0 | +0 | +0 |
| Milan Day | holdout | +0 | +0 | +0 |
| Milan Day | recentFrozen | +0 | +0 | +0 |
| Rajdhani Day | validation | +0 | +0 | +0 |
| Rajdhani Day | holdout | +0 | +0 | +0 |
| Rajdhani Day | recentFrozen | +0 | +0 | +0 |
| Kalyan | validation | +0 | +0 | +0 |
| Kalyan | holdout | +0 | +0 | +0 |
| Kalyan | recentFrozen | +0 | +0 | +0 |
| Sridevi Night | validation | +0 | +0 | +0 |
| Sridevi Night | holdout | +0 | +0 | +0 |
| Sridevi Night | recentFrozen | +0 | +0 | +0 |
| Kalyan Night | validation | +0 | +0 | +0 |
| Kalyan Night | holdout | +0 | +0 | +0 |
| Kalyan Night | recentFrozen | +0 | +0 | +0 |
| Madhur Night | validation | +0 | +0 | +0 |
| Madhur Night | holdout | +0 | +0 | +0 |
| Madhur Night | recentFrozen | +0 | +0 | +0 |
| Milan Night | validation | +0 | +0 | +0 |
| Milan Night | holdout | +0 | +0 | +0 |
| Milan Night | recentFrozen | +0 | +0 | +0 |
| Rajdhani Night | validation | +0 | +0 | +0 |
| Rajdhani Night | holdout | +0 | +0 | +0 |
| Rajdhani Night | recentFrozen | +0 | +0 | +0 |
| Main Bazar | validation | +0 | +0 | +0 |
| Main Bazar | holdout | +0 | +0 | +0 |
| Main Bazar | recentFrozen | +0 | +0 | +0 |

## Decision

REJECT: nested development found no all-market non-regressive gated pair better than the baseline; the deterministic selection therefore froze the no-gate control.

This is retrospective evidence. All historical rows were inspected by earlier research, so even a passing result would require a newly sealed cohort before any accuracy claim.

Input audit SHA-256: `21675bcb6b1764098b916c0f34f57b3139b17aa49956b1406c374cc693f62d24`

No production files were modified.
