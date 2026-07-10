# Two-Digit Multivariate Market kNN

Generated: 2026-07-10T07:32:52.162Z
Base context representations: 36
Prediction configurations: 864
Forward folds: 46
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=55.0% | 1380 | 49.7% (686/1380) | 1.44 | 46 |
| Best min 120 calls: validation calls>=60, validation>=55.0% | 1380 | 49.7% (686/1380) | 1.44 | 46 |
| Best min 720 calls: validation calls>=60, validation>=55.0% | 1380 | 49.7% (686/1380) | 1.44 | 46 |

## Interpretation

- Each market-day context contains only same-day events published before the target event under the conservative schedule.
- Historical neighbors combine digit-mask similarity, circular sutta/root distance, panel kind, sum, event scope, and recency weighting.
- Configuration selection uses training-to-validation predictions; test neighbors are drawn only from dates completed before the test date.