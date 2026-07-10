# Two-Digit Cross-Market Randomized Forest

Generated: 2026-07-10T07:44:49.595245+00:00
Base forest configs: 12
Model/target/confidence variants: 96
Forward folds: 48
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=70.0% | 63 | 63.5% (40/63) | 1.62 | 3 |
| Best min 120 calls: validation calls>=20, validation>=70.0% | 230 | 57.0% (131/230) | 1.55 | 24 |
| Best min 720 calls | n/a | n/a | n/a | n/a |

## Interpretation

- Bootstrap trees use randomized feature subsets and threshold splits over the time-safe cross-market matrix.
- Depth, leaf support, feature subsampling, digit-versus-pair target, and confidence cutoff are validation-selected before later test scoring.
- No external ML dependency is used; seeds and split quantiles are deterministic and reproducible.