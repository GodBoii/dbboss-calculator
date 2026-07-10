# Two-Digit Panel Shape Selector

Generated: 2026-07-09T17:55:08.053Z
Gate configs tested: 36
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: prev_house_shape, lookback=180, support>=8, val>=80.0% | 373 | 54.7% (204/373) | 1.50 |
| Best min 120 calls: prev_house_shape, lookback=180, support>=8, val>=80.0% | 373 | 54.7% (204/373) | 1.50 |
| Best min 720 calls: prev_house_shape, lookback=180, support>=8, val>=70.0% | 1554 | 53.9% (837/1554) | 1.49 |

## Interpretation

- This tests previous panel kind, sum/root, and low/high shape as avoid-pair contexts.
- Pair choice is selected only from matching historical buckets before each forward test window.
- If these fail, panel-shape context is not strong enough for safe two-digit avoid calls.