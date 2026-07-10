# Two-Digit House/Opposite Selector

Generated: 2026-07-09T17:45:10.532Z
Gate configs tested: 140
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: opposite_pairs, lookback=30, val>=80.0% | 30 | 70.0% (21/30) | 1.70 |
| Best min 120 calls: same_house_high, lookback=180, val>=60.0% | 210 | 55.7% (117/210) | 1.51 |
| Best min 720 calls: same_house_high, lookback=30, val>=70.0% | 810 | 54.4% (441/810) | 1.50 |

## Interpretation

- This tests house, parity, group, and opposite-number theories as constrained pair families.
- Pair choice is selected only from validation windows before each forward test window.
- If these constrained families fail, house/opposite theory is not strong enough for live avoid calls.