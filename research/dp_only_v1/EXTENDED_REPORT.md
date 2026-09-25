# Expanded DP-only research

## Decision

No tested policy earns a DP call. The validation-selected results do not support 90% holdout precision with adequate support.

## Data and timing

- 22 chart markets, 41,475 archived draw rows, 82,950 open/close outcomes, 68,870 events after the 320-result history warmup.
- DP means exactly two distinct digits. SP and TP are both non-DP.
- Chronological split: train through 2023-12-31, validate from 2024-01-01 through 2025-12-31, holdout from 2026-01-01.
- The earlier report already disclosed aggregate 2026 results, so this is a frozen one-pass diagnostic, not an untouched holdout.
- Historical charts were not independently audited against the originating operators.

## What was tested

- 100 rule configurations across 5 input families, with 60 distinct masks after tied thresholds.
- 100 classifier configurations across 10 estimator families. They are 100 tuned configurations, not 100 unique algorithms.
- 100 conditional hypothesis configurations across 10 broad theory families, not 100 independent scientific theories.
- 100 predefined, overlapping descriptive cohort slices.

## Base rate

| Split | Outcomes | DP | DP rate |
|---|---:|---:|---:|
| train | 32,832 | 7,946 | 24.2% |
| validation | 25,682 | 6,247 | 24.3% |
| holdout | 10,356 | 2,440 | 23.6% |

## Validation-selected classifiers

Each classifier was fit on the training data from all 22 markets. I selected the all-market winner and the app-market winner separately using validation results for that scope. This keeps the two policies and their support counts distinct.

| Selected scope | Classifier | Threshold | Validation calls | Correct | Precision | Exact one-sided 95% lower bound | Active days | Perfect days |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 22 markets | extra_trees 8 | 0.3274 | 113 | 44 | 38.9% | 31.2% | 95 | 36 |
| 12 app markets | hist_gradient_boost 10 | 0.3274 | 50 | 22 | 44.0% | 32.0% | 47 | 21 |

The lower-bound column uses a one-sided 95% exact binomial interval.

| Selected scope | Holdout calls | Correct | Precision | Exact one-sided 95% lower bound | Active days | Perfect days |
|---|---:|---:|---:|---:|---:|---:|
| 22 markets | 25 | 6 | 24.0% | 11.0% | 22 | 5 |
| 12 app markets | 29 | 6 | 20.7% | 9.4% | 24 | 4 |

A perfect day can come from one call, so the tables below show the support behind each daily rate. Daily scores do not replace aggregate precision.

### 22-market validation calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 77 | 77 | 35 | 45.5% | 35 |
| 2 | 18 | 36 | 9 | 25.0% | 1 |

### 22-market holdout calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 19 | 19 | 5 | 26.3% | 5 |
| 2 | 3 | 6 | 1 | 16.7% | 0 |

### 12-market validation calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 44 | 44 | 21 | 47.7% | 21 |
| 2 | 3 | 6 | 1 | 16.7% | 0 |

### 12-market holdout calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 19 | 19 | 4 | 21.1% | 4 |
| 2 | 5 | 10 | 2 | 20.0% | 0 |

## Validation-selected pattern rules

| Selected scope | Rule | Validation calls | Correct | Precision | Holdout calls | Correct | Precision | Exact one-sided 95% lower bound |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 22 markets | sequence_pattern:rate_80:q07 | 8,688 | 2,337 | 26.9% | 3,208 | 860 | 26.8% | 25.5% |
| 12 app markets | sequence_pattern:same_day_prior_dp_rate:q09 | 2,398 | 643 | 26.8% | 1,111 | 313 | 28.2% | 25.9% |

### 22-market validation pattern calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 4 | 10 | 40 | 11 | 27.5% | 0 |
| 5 | 25 | 125 | 31 | 24.8% | 0 |
| 6 | 34 | 204 | 34 | 16.7% | 0 |
| 7 | 40 | 280 | 74 | 26.4% | 0 |
| 8 | 15 | 120 | 29 | 24.2% | 0 |
| 9 | 17 | 153 | 38 | 24.8% | 0 |
| 10 | 33 | 330 | 79 | 23.9% | 0 |
| 11 | 72 | 792 | 226 | 28.5% | 0 |
| 12 | 86 | 1032 | 278 | 26.9% | 0 |
| 13 | 138 | 1794 | 498 | 27.8% | 0 |
| 14 | 113 | 1582 | 428 | 27.1% | 0 |
| 15 | 78 | 1170 | 314 | 26.8% | 0 |
| 16 | 36 | 576 | 144 | 25.0% | 0 |
| 17 | 14 | 238 | 71 | 29.8% | 0 |
| 18 | 14 | 252 | 82 | 32.5% | 0 |

### 22-market holdout pattern calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 3 | 1 | 3 | 1 | 33.3% | 0 |
| 4 | 2 | 8 | 3 | 37.5% | 0 |
| 5 | 10 | 50 | 10 | 20.0% | 0 |
| 6 | 12 | 72 | 15 | 20.8% | 0 |
| 7 | 9 | 63 | 11 | 17.5% | 0 |
| 8 | 9 | 72 | 14 | 19.4% | 0 |
| 9 | 9 | 81 | 28 | 34.6% | 0 |
| 10 | 21 | 210 | 53 | 25.2% | 0 |
| 11 | 30 | 330 | 95 | 28.8% | 0 |
| 12 | 25 | 300 | 77 | 25.7% | 0 |
| 13 | 24 | 312 | 83 | 26.6% | 0 |
| 14 | 30 | 420 | 124 | 29.5% | 0 |
| 15 | 40 | 600 | 167 | 27.8% | 0 |
| 16 | 30 | 480 | 129 | 26.9% | 0 |
| 17 | 9 | 153 | 39 | 25.5% | 0 |
| 18 | 3 | 54 | 11 | 20.4% | 0 |

### 12-market validation pattern calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 70 | 70 | 1 | 1.4% | 1 |
| 2 | 67 | 134 | 0 | 0.0% | 0 |
| 3 | 27 | 81 | 8 | 9.9% | 0 |
| 4 | 37 | 148 | 24 | 16.2% | 0 |
| 5 | 28 | 140 | 30 | 21.4% | 0 |
| 6 | 15 | 90 | 12 | 13.3% | 0 |
| 7 | 14 | 98 | 24 | 24.5% | 0 |
| 8 | 8 | 64 | 16 | 25.0% | 0 |
| 9 | 8 | 72 | 19 | 26.4% | 0 |
| 10 | 8 | 80 | 23 | 28.7% | 0 |
| 11 | 13 | 143 | 40 | 28.0% | 0 |
| 12 | 15 | 180 | 54 | 30.0% | 0 |
| 13 | 6 | 78 | 23 | 29.5% | 0 |
| 14 | 9 | 126 | 40 | 31.8% | 0 |
| 15 | 7 | 105 | 31 | 29.5% | 0 |
| 16 | 7 | 112 | 37 | 33.0% | 0 |
| 17 | 5 | 85 | 29 | 34.1% | 0 |
| 18 | 1 | 18 | 6 | 33.3% | 0 |
| 19 | 5 | 95 | 37 | 39.0% | 0 |
| 20 | 4 | 80 | 33 | 41.2% | 0 |
| 21 | 5 | 105 | 42 | 40.0% | 0 |
| 22 | 5 | 110 | 42 | 38.2% | 0 |
| 23 | 8 | 184 | 72 | 39.1% | 0 |

### 12-market holdout pattern calls per day

| Calls per day | Days | Calls | Correct | Precision | Perfect days |
|---:|---:|---:|---:|---:|---:|
| 1 | 28 | 28 | 1 | 3.6% | 1 |
| 2 | 20 | 40 | 0 | 0.0% | 0 |
| 3 | 15 | 45 | 2 | 4.4% | 0 |
| 4 | 12 | 48 | 8 | 16.7% | 0 |
| 5 | 10 | 50 | 10 | 20.0% | 0 |
| 6 | 9 | 54 | 8 | 14.8% | 0 |
| 7 | 3 | 21 | 5 | 23.8% | 0 |
| 8 | 2 | 16 | 3 | 18.8% | 0 |
| 9 | 5 | 45 | 10 | 22.2% | 0 |
| 10 | 5 | 50 | 15 | 30.0% | 0 |
| 11 | 6 | 66 | 19 | 28.8% | 0 |
| 12 | 8 | 96 | 27 | 28.1% | 0 |
| 13 | 1 | 13 | 4 | 30.8% | 0 |
| 14 | 4 | 56 | 18 | 32.1% | 0 |
| 15 | 2 | 30 | 13 | 43.3% | 0 |
| 16 | 1 | 16 | 5 | 31.2% | 0 |
| 17 | 6 | 102 | 35 | 34.3% | 0 |
| 18 | 1 | 18 | 8 | 44.4% | 0 |
| 19 | 1 | 19 | 6 | 31.6% | 0 |
| 20 | 5 | 100 | 35 | 35.0% | 0 |
| 21 | 4 | 84 | 34 | 40.5% | 0 |
| 22 | 1 | 22 | 8 | 36.4% | 0 |
| 23 | 4 | 92 | 39 | 42.4% | 0 |

## Same-day schedule analysis

For app markets only, each event can use same-day chart results only when the current app schedule places that source strictly before the target. This schedule may not match older historical draw timing.

In 2026, 187 days had at least 20 of 24 primary Open/Close outcomes. Mean observed DP count was 6.3797 per day, range 1 to 13.

A separate table in SAME_DAY_REGIME.md conditions the target result on both the number of earlier scheduled outcomes and their DP share. The highest 2026 cell was 77/221 (34.8%), with a 95% Wilson interval of 28.9%-41.3%. No cell approached 90%.

## Limits

- Candidate search can overfit validation, and the 2026 period has already been discussed in earlier work.
- A perfect small set of calls has a broad uncertainty interval. The outputs report exact one-sided 95% confidence bounds, not just hit rates.
- Theory-inspired tests measure associations. They do not prove why a DP occurred.
- A frozen live forward record is needed before the app can claim a stable 90% precision rate.

## Reproduction

Run python research/dp_only_v1/extended_matrix.py from the repository root. It reads chart_rows.csv and writes extended_results.json and this report.
