# Two present digits improvement study

Frozen local chart results through 2026-10-17. Both digits must appear in the same panel.

Compared 15 challengers with the live 180-result joint-frequency model. Selected `marginal_25` on 2021-2023 only. No market-specific tuning.

| Period | Events | Current hits | Challenger hits | Net hits | Paired p |
| --- | ---: | ---: | ---: | ---: | ---: |
| development | 15832 | 921 (5.82%) | 952 (6.01%) | +31 | 0.0815 |
| validation2024 | 7286 | 385 (5.28%) | 373 (5.12%) | -12 | 0.3594 |
| confirmation2025 | 7308 | 404 (5.53%) | 398 (5.45%) | -6 | 0.6909 |
| recent2026 | 5862 | 348 (5.94%) | 356 (6.07%) | +8 | 0.4608 |
| last7 | 122 | 8 (6.56%) | 8 (6.56%) | +0 | 1.0000 |
| last30 | 596 | 44 (7.38%) | 43 (7.21%) | -1 | 1.0000 |
| last90 | 1820 | 101 (5.55%) | 99 (5.44%) | -2 | 0.8555 |
| last180 | 3660 | 221 (6.04%) | 228 (6.23%) | +7 | 0.4270 |

## Decision

Eligible for a prospective trial: false.
Production model changed: false. Historical gains alone do not establish future accuracy.

Failed gates: validationImproves, confirmationImproves, confirmationPairedP, last90NonDegrading, last30NonDegrading.

## Method and limits

All inputs are tracked snapshots. Their SHA-256 hashes are in results.json. Conflicting duplicate market/date rows fail the run.

Every prediction uses strictly earlier dates from its own market and side, capped at 28 calendar months. At least 180 prior results are required. Neither the target panel nor same-day Open is used for Close.

Candidates include 30/90/365/730-result joint frequencies, equal blends with the baseline, 25/50/75% digit-marginal blends, and 25/50% weekday and previous-digit-set transition blends. Conditional estimates shrink toward the baseline with 50 pseudo-results. Ties choose the lowest digit pair.

Later periods never select a candidate. The recent windows overlap. These public histories were previously examined in other repository studies, so confirmation is retrospective, not an untouched holdout. Paired p-values treat panel events as independent; market and date dependence can make them optimistic.

The random-pair reference averages C(distinct panel digits, 2)/45 per outcome. It is a coverage reference, not a profit estimate. Full candidate comparisons and recent market-side scores are in results.json.

Reproduce with `python research/present_digits_v2/run_study.py`. Verify with `python -m unittest discover -s research/present_digits_v2 -p 'test_*.py'`.
