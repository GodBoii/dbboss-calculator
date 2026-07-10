# Two-Digit Regime/Volatility Selector

Generated: 2026-07-10T07:13:03.994Z
Regime modes tested: 5
Gate configs tested: 120
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: repeat_pressure, regime=15, validation=365, support>=10, val>=80.0% | 40 | 65.0% (26/40) | 1.63 | 5 |
| Best min 120 calls: entropy, regime=5, validation=180, support>=5, val>=70.0% | 201 | 58.7% (118/201) | 1.52 | 91 |
| Best min 720 calls | n/a | n/a | n/a | n/a |

## Interpretation

- Every regime label uses only panels before the predicted date.
- The pair for a regime is selected only from the preceding validation window, then scored on later rolling windows.
- Entropy, recent digit coverage, DP/TP pressure, panel-sum level, and consecutive-panel persistence are tested separately to limit overfitting.