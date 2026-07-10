# Two-Digit Fixed-Pair Rolling Selector

Generated: 2026-07-09T17:34:40.094Z
Gate configs tested: 100
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: lookback=30, val>=80.0%, valN>=20 | 90 | 57.8% (52/90) | 1.54 |
| Best min 120 calls: lookback=60, val>=70.0%, valN>=20 | 330 | 54.5% (180/330) | 1.50 |
| Best min 720 calls: lookback=30, val>=60.0%, valN>=20 | 4320 | 52.6% (2272/4320) | 1.47 |

## Interpretation

- This tests whether each market/side has a durable fixed two-digit avoid pair.
- Pair choice is selected only from validation history before each test window.
- If this cannot clear 80%, stable market-specific fixed pairs are not enough for live calls.