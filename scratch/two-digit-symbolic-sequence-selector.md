# Two-Digit Symbolic Sequence Selector

Generated: 2026-07-10T07:52:40.885Z
Base sequence models: 90
Model/support/risk variants: 540
Forward folds: 72
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=70.0% | 77 | 54.5% (42/77) | 1.51 | 3 |
| Best min 120 calls: validation calls>=20, validation>=60.0% | 1044 | 51.1% (534/1044) | 1.45 | 70 |
| Best min 720 calls: validation calls>=20, validation>=60.0% | 1044 | 51.1% (534/1044) | 1.45 | 70 |

## Interpretation

- Exact and backoff sequence grammars span root, kind, root-kind, mask, parity, house, sum band, panel edge, and root-delta symbols.
- Sequence length, lookback, support, and pair-risk rule are selected on validation before refitting through the cutoff and scoring later rows.
- Every context key ends at the previous result; the target panel is never included in its own sequence.