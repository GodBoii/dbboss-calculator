# DP-only prediction audit

## Decision

Do not issue a DP call. No tested rule or model supports 90% precision on unseen data. The app's analysis screen abstains for both Open and Close. Abstention does not mean SP is predicted.

## Data and label

- Fetched the 12 app markets in `links.txt` and 10 more markets linked by the same chart provider. The trusted `dpbossss.boston` links redirected to `dpboss.tax` on 2026-09-24, so the reproducible fetch uses that canonical host.
- Parsed 41,475 dated market draws, giving 82,950 Open or Close panel outcomes from 2013-05-06 through 2026-09-24.
- DP means a three-digit panel containing exactly two distinct digits. SP and TP both count as non-DP. The model does not predict a panel number, sutta, Jodi, or SP.
- Removed 49 conflicting duplicate chart rows and 43 rows where the chart's Jodi disagreed with the Open/Close panel sums. Blank draws were excluded. These are source-data checks, not signals.
- Earlier results from a different market on the same date were excluded because chart posting order is not established. The known same-market Open panel was allowed as a feature for Close only.

The source provider is not independently verified for every historical draw. A retrospective chart can contain corrections. This limits what any backtest can establish.

## Test design

1. Use data through 2024-12-31 for rule history and model fitting.
2. Select rules and probability thresholds using 2025 data.
3. Score once on 2026-01-01 through 2026-09-24. This is a chronological holdout, although it is still retrospective rather than a live forward record.
4. Require both precision and the number of DP calls in the final result. A rule that calls once and happens to be right does not establish 90% reliability.

The search evaluated 1,200 single and paired rule configurations and 198 thresholds across logistic regression, random forest, and gradient boosting. Features covered recent DP frequency and gaps, previous Open/Close kinds, weekday and calendar effects, previous-day cross-market DP counts, and digit sum, spread, and entropy of past panels. These are 1,398 configurations, not 1,398 independent scientific theories. Searching more configurations raises overfitting risk; the sealed 2026 period is what matters.

## Results

| 2026 holdout | DP calls | Correct | Precision |
| --- | ---: | ---: | ---: |
| All 22 markets, base DP rate | 10,432 outcomes | 2,464 DPs | 23.6% |
| Best validation-selected rule | 55 | 12 | 21.8% |
| Logistic regression gate | 117 | 32 | 27.4% |
| Random forest gate | 81 | 26 | 32.1% |
| Gradient boosting gate | 534 | 153 | 28.7% |

For the 12 app markets alone, the rule made 38 DP calls and got 10 right, 26.3%. The forest gate got 3 of 4 right. Four calls provide no credible evidence of 90% precision.

The best rule appeared stronger in 2025 at 54/131, 41.2%, then fell to 12/55, 21.8% in 2026. This is a direct example of why a promising historical pattern cannot be shown as a 90% probability. The best model discrimination was weak, with held-out ROC AUC at most 0.558.

## What would change the decision

A new candidate needs a written rule fixed before evaluation, a fresh prospective record of every eligible Open and Close decision including abstentions, enough DP calls to make the estimate stable, and an observed precision whose lower confidence bound clears 90%. Until then, the only honest output is no DP call.

Run `python research/dp_only_v1/run_research.py` to refetch and repeat the audit. Run it with `--offline` to reproduce from `chart_rows.csv`. Full source counts, split sizes, and model results are in `results.json`.
