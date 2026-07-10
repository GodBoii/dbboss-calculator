# Two-Digit Context Multi-Block Durability Gate

Generated: 2026-07-10T13:10:22.804Z
Durability configs tested: 840
Forward folds: 144
Viable >=80% configs with >=30 calls: 0
Viable >=85% configs with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: each>=40.0%, aggregate>=70.0%, spread<=10.0%, latest>=50.0% | 30 | 76.7% (23/30) | 1.77 | 1 |
| Best min 120 calls: each>=55.0%, aggregate>=65.0%, spread<=20.0%, latest>=50.0% | 420 | 54.5% (229/420) | 1.50 | 14 |
| Best min 720 calls: each>=55.0%, aggregate>=60.0%, spread<=20.0%, latest>=50.0% | 1560 | 52.6% (821/1560) | 1.49 | 52 |

## Madhur Night Latest Profile

- Validation blocks: 66.7%, 73.3%, 70.0%.
- Validation aggregate: 70.0%; spread: 6.7%.
- Later test: 76.7% (23/30).

## Interpretation

- Every selected fold must show validation strength in three chronological blocks, not only in the 90-day aggregate.
- Gate thresholds are applied before the test window; the reported best configuration remains exploratory because it is selected from many backtest gates.
- Repeated high test folds are required before a durability gate can become a live call rule.