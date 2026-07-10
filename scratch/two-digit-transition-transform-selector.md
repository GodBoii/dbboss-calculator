# Two-Digit Transition Transform Selector

Generated: 2026-07-09T18:10:40.688Z
Modes tested: 15
Gate configs tested: 20
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|
| Best min 30 calls: lookback=180, val>=60.0% | 180 | 55.0% (99/180) | 1.51 |
| Best min 120 calls: lookback=180, val>=60.0% | 180 | 55.0% (99/180) | 1.51 |
| Best min 720 calls: lookback=180, val>=55.0% | 1603 | 50.7% (812/1603) | 1.46 |

## Interpretation

- This tests direct transition-transform rules from previous panels, missing digits, opposite mappings, roots, and suttas.
- Rule choice is selected only from validation windows before each forward test window.
- If these fail, simple previous-result transforms are not strong enough for safe two-digit avoid calls.