# Two-Digit Time-Ordered Market Graph

Generated: 2026-07-10T07:28:00.545Z
Feature modes: 18
Base source/feature models across targets: 3414
Pair variants per model: 8
Forward folds: 69
Viable >=80% gates with >=30 calls: 0
Viable >=85% gates with >=30 calls: 0

## Best Gates

| Gate | Calls | Strict Accuracy | Avg Digits | Folds |
|---|---:|---:|---:|---:|
| Best min 30 calls: validation calls>=60, validation>=70.0% | 60 | 51.7% (31/60) | 1.47 | 2 |
| Best min 120 calls: validation calls>=60, validation>=60.0% | 1882 | 50.4% (949/1882) | 1.45 | 65 |
| Best min 720 calls: validation calls>=60, validation>=60.0% | 1882 | 50.4% (949/1882) | 1.45 | 65 |

## Interpretation

- Same-day source panels are used only when their conservative publication event precedes the target event.
- Near-simultaneous Milan/Rajdhani events are not allowed to predict one another; the same restriction applies to Kalyan Night/Rajdhani Night opens.
- Source feature and pair formula are selected on an earlier validation period, then refit through that cutoff and scored later.