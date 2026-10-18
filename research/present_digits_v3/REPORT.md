# Pooled and supervised two-present-digit study

Results through 2026-10-17. Both selected digits must appear in the same panel.

Tested 26 new challengers. Selected `pool_all_75` on 2021-2023 only.

| Period | Events | Current model | Selected challenger | Net hits |
| --- | ---: | ---: | ---: | ---: |
| development | 15832 | 921 (5.82%) | 958 (6.05%) | +37 |
| validation | 7286 | 385 (5.28%) | 396 (5.44%) | +11 |
| confirmation | 7308 | 404 (5.53%) | 424 (5.80%) | +20 |
| recent | 5862 | 348 (5.94%) | 359 (6.12%) | +11 |
| last7 | 122 | 8 (6.56%) | 11 (9.02%) | +3 |
| last30 | 596 | 44 (7.38%) | 44 (7.38%) | +0 |
| last90 | 1820 | 101 (5.55%) | 102 (5.60%) | +1 |
| last180 | 3660 | 221 (6.04%) | 208 (5.68%) | -13 |

## Decision

Eligible for a prospective trial: false. Production changed: false.

Failed checks: weeklyBootstrapPositive.

Weekly bootstrap 95% interval for 2025-onward accuracy lift: -0.19% to +0.63%. Whole calendar weeks are resampled together across markets and sides.

## Models and timing

Six pooled-frequency models blend the local model with same-side or all-side counts from other markets and the local market. Two conditional models pool successors to the same previous sutta. Conditional estimates use 100 pseudo-results from the same-side pooled prior.

Eighteen ridge models learn 45 pair-appearance residuals relative to the live model. Context features are market, side, target weekday, previous Open and Close suttas and panel kinds, 30/180-result digit frequencies from each side, and the local pair probabilities. Sequence variants add three prior Open and Close digit masks. Features are standardized from training rows only. The intercept is unpenalized. Predictions are clipped to [0,1]. Scores are estimates, not verified confidence percentages.

Models refit at each quarter boundary on prior outcomes within 28 calendar months. Features and pooled counts use strictly earlier dates, also capped at 28 calendar months. Same-day Open is excluded from Close. At least 180 own-market rows are required. All candidates score the same events. Lowest digit-pair order breaks ties. The fit audit is in results.json.

## Limits and reproduction

The protocol was committed before this experiment ran. These public histories have been examined in earlier studies, so this remains retrospective evidence. Later periods never select a new winner. Recent windows overlap. Bootstrap intervals describe the frozen candidate and do not correct for the repository's cumulative model search.

The 6.67% figure for an SP panel is a random-pair coverage reference, not a ceiling on predictive accuracy. A predictive signal could exceed it; this experiment must demonstrate such a signal on later data.

## Frozen next-result calls

forward_registry.json freezes 24 offline research calls from pool_all_75 using only results through October 17. Each market is scored on its first subsequently observed complete row. Both its Open and Close pairs are fixed now, alongside the baseline pairs. These observations do not change the failed promotion decision or the live app.

Score a complete updated chart CSV with `python research/present_digits_v3/forward.py score --input rows.csv`. The schema is `date,market,open,close`. The scorer never refits or overwrites the registry, and records the input hashes. The default sources currently leave all 24 calls pending. One batch of 24 calls cannot establish a small accuracy edge.

Source and protocol hashes, all candidate comparisons, recent market-side scores, and quarterly training dates are in results.json. audit.csv contains the selected and baseline pair calls on every 2021-onward event. Study artifact hashes normalize line endings to LF; external source hashes describe the original input bytes.

Run `python research/present_digits_v3/run_study.py`, then `python -m unittest discover -s research/present_digits_v3 -p 'test_*.py'`. Only NumPy and the Python standard library are required.
