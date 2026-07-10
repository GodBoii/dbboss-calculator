# Two-Digit Portfolio Selector Gate

Generated: 2026-07-09T17:21:57.847Z
Market-sides: 24
Gate configs tested: 112
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Selected Market-Sides | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|---:|
| Full coverage: val>=0.0%, valN>=20, digitWeight=10 | 24 | 720 | 54.7% (394/720) | 1.50 |
| Best min 30 calls: val>=70.0%, valN>=20, digitWeight=0 | 1 | 30 | 76.7% (23/30) | 1.77 |
| Best min 120 calls: val>=0.0%, valN>=20, digitWeight=10 | 24 | 720 | 54.7% (394/720) | 1.50 |

## Interpretation

- This tests a validation-only portfolio selector across baseline, deep research, meta formula, context learner, and supervised ranker outputs.
- It asks whether choosing the best model family per market/side can reach the 80-85% strict target.
- If no validation threshold produces >=80% with enough calls, the current model family pool is not enough for live avoid betting.