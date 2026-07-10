# Two-Digit Nonlinear Cross-Market Classifier

Generated: 2026-07-10T07:39:08.800419+00:00
Base representations: 19
Model/target/confidence variants: 456
Forward folds: 48
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=60.0% | 1112 | 51.2% (569/1112) | 1.46 | 46 |
| Best min 120 calls: validation calls>=60, validation>=60.0% | 1112 | 51.2% (569/1112) | 1.46 | 46 |
| Best min 720 calls: validation calls>=60, validation>=60.0% | 1112 | 51.2% (569/1112) | 1.46 | 46 |

## Interpretation

- Linear ridge, ReLU, tanh, and Fourier random-feature networks are trained only on dates before validation.
- Models jointly estimate ten digit-appearance risks and all 45 strict pair-absence targets.
- Architecture, regularization, target type, and confidence cutoff are selected on validation; the frozen model is then scored on later test rows.