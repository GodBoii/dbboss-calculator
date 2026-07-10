# Two-Digit Context Weekday Guardian

Generated: 2026-07-10T08:01:04.809Z
Guardian configs: 42
Selector gates: 9
Forward folds: 144
Viable >=80% selector results with >=30 calls: 0
Viable >=85% selector results with >=30 calls: 0

## Best Rolling Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=70.0% | 687 | 50.2% (345/687) | 1.46 | 33 |
| Best min 120 calls: validation calls>=60, validation>=70.0% | 687 | 50.2% (345/687) | 1.46 | 33 |
| Best min 720 calls: validation calls>=30, validation>=75.0% | 900 | 49.9% (449/900) | 1.44 | 85 |

## Exploratory Madhur Night Close Pocket

- Validation-learned allowed weekdays: Sat, Mon, Tue, Thu, Fri.
- Validation: 75.0% (57/76).
- Later 30-day window after filtering: 80.0% (20/25).
- Warning: Post-hoc research discovery on an already inspected test window; requires fresh pre-registered confirmation.

## Interpretation

- Each guardian learns allowed weekday/context groups only from a fold's validation predictions, then filters its later test predictions.
- The rolling aggregate determines whether the procedure repeats; an isolated post-hoc 80% pocket is not production proof.
- A fresh forward register is required before the exploratory Madhur Night rule can be treated as evidence.