# Two-Digit Calendar Bucket Selector

Generated: 2026-07-09T17:42:30.608Z
Gate configs tested: 32
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: dom_mod5, lookback=365, support>=5, val>=70.0% | 105 | 58.1% (61/105) | 1.55 |
| Best min 120 calls: month_phase, lookback=180, support>=5, val>=70.0% | 229 | 54.1% (124/229) | 1.50 |
| Best min 720 calls: dom_mod5, lookback=180, support>=5, val>=70.0% | 1033 | 51.1% (528/1033) | 1.46 |

## Interpretation

- This tests calendar-date bucket theories: exact date, date modulo cycles, month phase, payday/month-end phase, and month parity.
- Pair choice is selected only from matching historical calendar buckets before each test window.
- If these buckets fail forward, calendar timing is not strong enough for safe two-digit avoid calls.