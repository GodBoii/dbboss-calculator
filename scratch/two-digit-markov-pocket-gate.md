# Two-Digit Markov Pocket Gate

Generated: 2026-07-09T17:17:11.198Z
Gate configs tested: 125
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Selected Folds | Calls | Strict Accuracy | Avg Digits |
|---|---:|---:|---:|---:|
| Best coverage at >=80% | n/a | n/a | n/a | n/a |
| Best accuracy min 30 calls: support>=8, val>=80.0%, maxRules=8 | 12 | 32 | 56.3% (18/32) | 1.41 |
| Best accuracy min 60 calls: support>=3, val>=85.0%, maxRules=5 | 27 | 62 | 45.2% (28/62) | 1.42 |

## Interpretation

- This is a selective abstention gate on top of the Markov/transition model.
- It mines high-accuracy validation pockets by pair/state/source labels, then scores only matching future test calls.
- A useful live gate must keep >=80% strict accuracy with enough calls to matter; tiny perfect pockets are not enough.
- If no >=80% config with reasonable call count appears here, the Markov pocket is not deployable as a money-risk avoid-call engine yet.