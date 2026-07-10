# Two-Digit Digit Risk Gate

Generated: 2026-07-09T17:32:21.305Z
Base digit-risk configs: 16
Validation gate configs: 27

## Rolling Result

- Strict accuracy: 55.5% (106/191)
- Average correctly eliminated digits: 1.51 / 2
- Selected folds: 14
- Folds >=70%: 3/14
- Folds >=80%: 0/14

| Market | Side | Window | Val | Test | Calls | Avg Digits |
|---|---|---|---:|---:|---:|---:|
| Sridevi | open | 2026-06-06..2026-07-05 | 65.2% (15/23) | 57.1% (4/7) | 7 | 1.43 |
| Sridevi | close | 2026-06-06..2026-07-05 | 65.2% (15/23) | 40.0% (4/10) | 10 | 1.30 |
| Time Bazar | open | 2026-06-01..2026-07-04 | 65.2% (15/23) | 77.8% (7/9) | 9 | 1.78 |
| Time Bazar | close | 2026-06-01..2026-07-04 | 65.2% (15/23) | 58.8% (10/17) | 17 | 1.53 |
| Madhur Day | open | 2026-06-06..2026-07-05 | 70.8% (17/24) | 71.4% (15/21) | 21 | 1.71 |
| Rajdhani Day | open | 2026-06-01..2026-07-04 | 66.7% (30/45) | 60.0% (9/15) | 15 | 1.60 |
| Kalyan | open | 2026-06-01..2026-07-04 | 65.2% (15/23) | 0.0% (0/2) | 2 | 1.00 |
| Sridevi Night | open | 2026-06-06..2026-07-05 | 68.9% (31/45) | 66.7% (10/15) | 15 | 1.60 |
| Sridevi Night | close | 2026-06-06..2026-07-05 | 73.9% (17/23) | 47.1% (8/17) | 17 | 1.41 |
| Kalyan Night | open | 2026-05-20..2026-07-03 | 69.6% (16/23) | 35.3% (6/17) | 17 | 1.24 |
| Madhur Night | close | 2026-06-01..2026-07-04 | 65.2% (15/23) | 61.5% (16/26) | 26 | 1.62 |
| Milan Night | open | 2026-06-01..2026-07-04 | 73.9% (17/23) | 71.4% (5/7) | 7 | 1.71 |
| Main Bazar | open | 2026-05-25..2026-07-03 | 69.6% (16/23) | 50.0% (1/2) | 2 | 1.50 |
| Main Bazar | close | 2026-05-25..2026-07-03 | 82.6% (19/23) | 42.3% (11/26) | 26 | 1.35 |

## Interpretation

- This models digit appearance risk first, then forms a two-digit avoid pair from the lowest-risk digits.
- It abstains using validation-calibrated risk thresholds rather than pair-history thresholds.
- A live-safe version would require repeated >=80% strict test folds, not just high validation fit.