# Two-Digit Latent-Regime Selector

Generated: 2026-07-10T07:19:37.671Z
Latent-state configurations: 128
Validation selector gates: 6
Forward folds: 72
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=30, validation>=70.0% | 30 | 66.7% (20/30) | 1.63 | 1 |
| Best min 120 calls: validation calls>=30, validation>=60.0% | 1706 | 51.6% (880/1706) | 1.46 | 57 |
| Best min 720 calls: validation calls>=30, validation>=60.0% | 1706 | 51.6% (880/1706) | 1.46 | 57 |

## Interpretation

- K-means states use only pre-result digit, shape, entropy, sum, and persistence features.
- Each fold uses separate training, validation, and later test periods; configuration selection never sees test outcomes.
- The winning configuration is refit through the validation cutoff before scoring the untouched test window.