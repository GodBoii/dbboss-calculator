# Two-Digit Online Expert Ensemble

Generated: 2026-07-10T07:15:21.869Z
Expert models: 133
Adaptive voting configs: 36
Validation selector gates: 6
Forward folds: 72
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=20, validation>=60.0% | 180 | 48.3% (87/180) | 1.42 | 6 |
| Best min 120 calls: validation calls>=20, validation>=60.0% | 180 | 48.3% (87/180) | 1.42 | 6 |
| Best min 720 calls | n/a | n/a | n/a | n/a |

## Interpretation

- All catalog models vote; weights are updated only after each outcome becomes available.
- Voting mode, learning speed, memory decay, and abstention confidence are selected on the preceding validation period before each forward test fold.
- This is a numeric adaptive-agent benchmark. An LLM still cannot improve it merely by narrating the same historical inputs.