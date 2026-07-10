# Two-Digit Temporal Reservoir

Generated: 2026-07-10T07:50:17.360375+00:00
Reservoir dynamics: 24
Model/target/confidence variants: 576
Forward folds: 48
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=20, validation>=80.0% | 71 | 60.6% (43/71) | 1.61 | 8 |
| Best min 120 calls: validation calls>=20, validation>=70.0% | 304 | 55.6% (169/304) | 1.52 | 39 |
| Best min 720 calls: validation calls>=60, validation>=60.0% | 985 | 52.7% (519/985) | 1.47 | 42 |

## Interpretation

- Echo-state reservoirs carry nonlinear sequence memory through each market-side chronology.
- Inputs contain only previous target history and same-day market events published before the target event.
- Reservoir dynamics, readout regularization, target type, and confidence cutoff are selected on validation before frozen later scoring.