# Two-Digit Cross-Market Lead/Lag Selector

Generated: 2026-07-09T18:04:04.087Z
Gate configs tested: 27
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: lookback=90, lag=1, val>=65.0% | 30 | 53.3% (16/30) | 1.47 |
| Best min 120 calls | n/a | n/a | n/a |
| Best min 720 calls | n/a | n/a | n/a |

## Interpretation

- This tests whether source-market avoid-pair behavior leads target-market avoid digits.
- Source market/side and lag are selected only from validation windows before each forward test window.
- If this fails, cross-market lead/lag is not strong enough for live two-digit avoid calls.