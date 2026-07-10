# Two-Digit Rolling Portfolio Selector

Generated: 2026-07-09T17:24:24.433Z
Grouped forward folds: 216
Gate configs tested: 630
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Selected Folds | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|---:|
| Best min 30 calls: val>=70.0%, valN>=20, testN>=10, digitWeight=0 | 5 | 95 | 66.3% (63/95) | 1.65 |
| Best min 120 calls: val>=70.0%, valN>=5, testN>=10, digitWeight=0 | 8 | 146 | 61.6% (90/146) | 1.60 |
| Best min 720 calls: val>=65.0%, valN>=5, testN>=5, digitWeight=0 | 81 | 1411 | 54.0% (762/1411) | 1.49 |

## Family Mix For Best Min-30 Gate

| Family | Selected | Strict Accuracy |
|---|---:|---:|
| meta_formula | 1 | 46.7% (14/30) |
| bayesian_gate | 3 | 74.3% (26/35) |
| context_learner | 1 | 76.7% (23/30) |

## Interpretation

- This tests whether validation-selected model choice is stable across repeated forward windows.
- It uses rolling outputs from meta formula, context learner, Markov transition, and Bayesian gate families.
- A single latest-window 76.7% pocket is not enough; this rolling check shows whether the idea repeats.