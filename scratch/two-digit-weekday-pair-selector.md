# Two-Digit Weekday Pair Selector

Generated: 2026-07-09T17:37:27.503Z
Gate configs tested: 80
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: lookback=90, support>=3, val>=80.0% | 1264 | 52.3% (661/1264) | 1.47 |
| Best min 120 calls: lookback=90, support>=3, val>=80.0% | 1264 | 52.3% (661/1264) | 1.47 |
| Best min 720 calls: lookback=90, support>=3, val>=80.0% | 1264 | 52.3% (661/1264) | 1.47 |

## Interpretation

- This tests whether avoid pairs are stable within market/side/weekday buckets.
- Pair choice is selected only from matching weekdays before each test window.
- If weekday-conditioned pairs fail, the weekly rhythm theory is not strong enough for live avoid calls.