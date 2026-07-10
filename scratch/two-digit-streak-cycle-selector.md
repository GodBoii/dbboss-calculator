# Two-Digit Streak/Cycle Selector

Generated: 2026-07-09T18:08:05.803Z
Modes tested: 7
Gate configs tested: 24
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: lookback=60, val>=70.0% | 30 | 60.0% (18/30) | 1.60 |
| Best min 120 calls: lookback=30, val>=70.0% | 360 | 55.0% (198/360) | 1.48 |
| Best min 720 calls: lookback=180, val>=55.0% | 900 | 53.2% (479/900) | 1.49 |

## Interpretation

- This tests missing-streak, recent-absence, recent-failure, and digit-gap cycle theories.
- Strategy choice is selected only from validation windows before each forward test window.
- If these fail, streak/cycle behavior is not strong enough for safe two-digit avoid calls.