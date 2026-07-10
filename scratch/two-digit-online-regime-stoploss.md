# Two-Digit Online Regime / Stop-Loss Gate

Generated: 2026-07-10T13:13:58.746Z
Sequential configs: 134
Selector gates: 12
Forward folds: 144
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=10, validation>=65.0% | 1036 | 53.5% (554/1036) | 1.49 | 83 |
| Best min 120 calls: validation calls>=10, validation>=65.0% | 1036 | 53.5% (554/1036) | 1.49 | 83 |
| Best min 720 calls: validation calls>=10, validation>=65.0% | 1036 | 53.5% (554/1036) | 1.49 | 83 |

## Madhur Night Latest Sequential Gate

- Selected config: {"mode":"ewma","alpha":0.3,"threshold":0.55}.
- Calibration-validation calls: 25; accuracy 72.0%.
- Later sequential calls: 25; accuracy 76.0% (19/25).

## Interpretation

- Each online decision uses only earlier hypothetical model outcomes and updates after the actual result becomes available.
- Gate configuration is chosen on the last 30 validation rows after initialization from the preceding 60, then frozen for the test window.
- Broad rolling performance, not one hot regime, determines whether sequential continuation can be deployed.