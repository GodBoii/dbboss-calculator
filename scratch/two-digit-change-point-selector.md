# Two-Digit Change-Point Selector

Generated: 2026-07-10T07:21:36.361Z
Prediction configurations: 404
Validation selector gates: 5
Forward folds: 72
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=60.0% | 1410 | 52.7% (743/1410) | 1.47 | 47 |
| Best min 120 calls: validation calls>=60, validation>=60.0% | 1410 | 52.7% (743/1410) | 1.47 | 47 |
| Best min 720 calls: validation calls>=60, validation>=60.0% | 1410 | 52.7% (743/1410) | 1.47 | 47 |

## Interpretation

- Fixed windows, exponentially decayed memory, and distribution-shift window switching are evaluated under the same forward protocol.
- Shift detectors compare recent versus prior digit rates, repeat pressure, and normalized panel sums without seeing the target result.
- Pair scoring tests joint historical absence, marginal digit risk, minimax risk, and a joint/marginal blend.