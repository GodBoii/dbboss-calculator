# Two-Digit Sutta Bucket Selector

Generated: 2026-07-09T17:49:53.376Z
Gate configs tested: 24
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: prev_jodi, lookback=180, support>=5, val>=70.0% | 125 | 56.8% (71/125) | 1.50 |
| Best min 120 calls: prev_jodi, lookback=180, support>=5, val>=70.0% | 125 | 56.8% (71/125) | 1.50 |
| Best min 720 calls: prev_jodi, lookback=365, support>=5, val>=70.0% | 1309 | 54.3% (711/1309) | 1.49 |

## Interpretation

- This tests whether previous sutta, opposite-side sutta, jodi, and simple sutta buckets produce stable avoid pairs.
- Pair choice is selected only from matching sutta buckets before each forward test window.
- If these buckets fail, sutta context alone is not enough for safe two-digit avoid calls.