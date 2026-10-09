# Same-market Open-to-Close DP feature: keep it out of production

The learned daily-slate feature has a small retrospective probability-score gain, but it does not establish an incremental benefit over calibration alone. Its uncertainty intervals include zero, some markets regress, and the short post-study audit regresses. No candidate produces a call at the unchanged 90% probability threshold. Keep the new feature out of production and leave the existing verified DP gate closed.

## What production already uses

`src/lib/predictor/dp-kind-context.ts` already multiplies Close DP pressure by 1.10 after a same-market DP Open and by 0.92 after a non-DP Open. The replay includes this behavior and operator adjustments. The study feature would be an extra learned conditional effect, so its comparison must include the current heuristic. Do not stack the study's published conditional rates as another uncalibrated multiplier.

`src/lib/verified-dp-call.ts` requires a frozen rule that demonstrates 90% precision on unseen outcomes and currently always abstains. The older SP/DP kind forecast uses pressure thresholds and overrides, not this verified gate. We report its calls separately. The DP panel list is a conditional ranking among DP panels; its ranking scores are not the probability that the Close itself will be DP.

## Design and scope

Fit on 7,571 weekday Close outcomes from 2023-07-01 through 2025-12-31. The held-out parameter-fit comparison covers 2,369 live Close outcomes across 199 weekdays and all 12 markets, from 2026-01-01 through 2026-10-08. Actual coverage, not scheduled draws, determines the counts. There are no scored Closes with missing Open results; synthetic checks cover the missing-Open fallback.

The feature is the study's `k_cond`, the log-odds difference between a market's smoothed Close DP rate conditional on today's Open DP/non-DP and its decayed Close base rate. Both states use prior weekday outcomes since 2016. Fit global coefficients on the fixed fit block. Do not select the three highlighted markets from their 2026 results. See [PROTOCOL.md](PROTOCOL.md) for the frozen design and regularization.

Production runtime inputs use the rolling 28-month window, including weekends. Live Close adds only today's own Open, with Close panel, Close Sutta and Jodi blanked. No other same-day results enter the comparison. The source is frozen through October 8; today's partial results are excluded. The daily-slate source was extended with the repository's frozen October 8 snapshot, adding 79 market-days with zero conflicting rows. The merged snapshot has 23,062 market-days.

The January-October 1 block was already inspected by the daily-slate study. October 2-8 was also inspected by other repository studies. These are retrospective held-out-from-fit audits, not blind forward evidence. The current-code production comparator contains previously selected rules, so it is not a historical as-deployed reconstruction. Schedule order alone cannot establish historical publication times; live results assume the own Open had actually been declared.

## Calibration and proper scores

All 2026 live Close outcomes. Lower Brier, log loss and fixed-bin calibration error are better. Calibration error is the sample-weighted absolute forecast/observed difference in ten fixed probability bins; it is descriptive and bin-dependent.

| Model | Brier | Log loss | Mean forecast | Observed DP | Calibration error | Max probability | Calls at 90% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Current production | 0.188062 | 0.563692 | 26.64% | 24.78% | 2.46% | 48.80% | 0 |
| Calibration alone | 0.187287 | 0.562626 | 24.44% | 24.78% | 1.42% | 38.57% | 0 |
| Calibration + study feature | 0.186619 | 0.560971 | 24.69% | 24.78% | 1.63% | 42.14% | 0 |
| One-coefficient feature correction | 0.187751 | 0.562926 | 26.91% | 24.78% | 2.41% | 53.96% | 0 |

Positive paired gain means lower candidate loss. Intervals resample whole calendar dates, keeping markets on the same date together, with 3,000 seeded bootstrap replicates. They are not corrected for multiple comparisons.

| Comparison | Brier gain | 95% interval | Log-loss gain | 95% interval |
| --- | --- | --- | --- | --- |
| Calibration + study feature vs Current production | +0.001443 | -0.000567 to +0.003211 | +0.002721 | -0.002554 to +0.007385 |
| Calibration + study feature vs Calibration alone | +0.000668 | -0.000333 to +0.001691 | +0.001654 | -0.001088 to +0.004362 |
| One-coefficient feature correction vs Current production | +0.000312 | -0.000371 to +0.001011 | +0.000766 | -0.000844 to +0.002382 |

The study feature reduces average Brier loss, but every paired interval spans zero. Its calibration error is worse than calibration alone. The smaller one-coefficient correction also has an interval spanning zero and increases the overall overforecast bias. Neither result supports a production patch.

## Precision at the unchanged threshold

All four models make zero calls at probability >= 0.90. Coverage and recall are zero; precision and its interval are undefined, not 100% or 0%. The existing verified gate also makes zero calls. There is no demonstrated precision or coverage improvement under the production call contract.

The older heuristic kind forecast calls DP 308 times and hits 88, for 28.57% precision. These are diagnostic kind forecasts, not qualifying 90% calls.

Even the study's highlighted same-market DP-Open condition stays far below 90% on the later data:

| Market | Close DP after DP Open | Close DP after non-DP Open | DP-Open condition 95% Wilson interval |
| --- | --- | --- | --- |
| Sridevi Night | 26/63 = 41.27% | 25/136 = 18.38% | 29.96% to 53.58% |
| Sridevi | 21/51 = 41.18% | 39/148 = 26.35% | 28.75% to 54.83% |
| Milan Day | 21/50 = 42.00% | 40/148 = 27.03% | 29.38% to 55.77% |

Non-DP includes TP. The study's SP label was shorthand for non-DP; this evaluation does not silently treat TP as DP or exclude it from the negative class.

## Later and recent blocks

| Block | Outcomes / weekdays | Production Brier | Calibration Brier | Calibration + feature Brier | One-coefficient Brier | Feature gain over calibration, 95% interval |
| --- | --- | --- | --- | --- | --- | --- |
| retrospective2026, 2026-01-01 to 2026-10-01 | 2321 / 194 | 0.187437 | 0.186562 | 0.185782 | 0.187056 | +0.000779, -0.000307 to +0.001812 |
| postStudy, 2026-10-02 to 2026-10-08 | 48 / 5 | 0.218293 | 0.222364 | 0.227077 | 0.221322 | -0.004713, -0.008246 to -0.000056 |
| last30, 2026-09-09 to 2026-10-08 | 249 / 22 | 0.176728 | 0.177176 | 0.176604 | 0.176225 | +0.000572, -0.002546 to +0.003823 |
| last90, 2026-07-13 to 2026-10-08 | 753 / 64 | 0.193979 | 0.194280 | 0.193156 | 0.193229 | +0.001124, -0.000765 to +0.003116 |

The post-study block has only 48 outcomes on five weekdays, so it cannot establish long-term performance. It worsens both Brier and log loss for the new feature. Recent 30/90-day windows overlap the main audit and are descriptive, not extra independent replications.

## Market stability

Positive gain means improvement. These are diagnostics, not market routes selected for production.

| Market | Outcomes | Feature Brier gain over calibration | One-coefficient Brier gain over production |
| --- | --- | --- | --- |
| Kalyan | 199 | -0.001790 | -0.001068 |
| Kalyan Night | 196 | -0.001581 | -0.002812 |
| Madhur Day | 195 | +0.001104 | +0.000631 |
| Madhur Night | 195 | +0.000417 | -0.000083 |
| Main Bazar | 198 | +0.000052 | -0.000151 |
| Milan Day | 198 | +0.003065 | +0.001823 |
| Milan Night | 198 | +0.000501 | -0.000399 |
| Rajdhani Day | 195 | +0.001041 | +0.002355 |
| Rajdhani Night | 199 | +0.000701 | +0.000222 |
| Sridevi | 199 | +0.001446 | +0.001519 |
| Sridevi Night | 199 | +0.007097 | +0.003828 |
| Time Bazar | 198 | -0.004073 | -0.002142 |

The calibrated feature regresses in Kalyan, Kalyan Night and Time Bazar. Its largest improvement is in Sridevi Night. Four of ten calendar-month blocks regress against calibration alone. Full monthly scores, fixed calibration bins, fit-market coverage, coefficients and call diagnostics are in [results.json](results.json). No market-specific promotion is justified by these reused diagnostics.

## Verification and reproduction

The fast replay matched the full `analyzeMarket` Close kind output on 33 market/date samples covering fit and test periods. Checks compare probability, predicted kind, confidence and DP bias. Focused tests verify current/future Close exclusion, weekend exclusion from the study state, TP/non-DP handling, missing-Open fallback, undefined zero-call precision, saved predictions, metrics, source/code hashes and the closed gate.

The frozen source and compressed prediction ledgers are included. The fit outputs do not touch production source, weights, thresholds, panel rankings or app behavior. Reproduce without fetching new data:

```powershell
node research/dp_open_close_v1/replay.cjs
python research/dp_open_close_v1/evaluate.py
python research/dp_open_close_v1/report.py
python research/dp_open_close_v1/verify.py
```

Use the saved Python dependency versions in `results.json`. The optional `--freeze-source` command rebuilds the source from the local daily-slate inputs and October 8 snapshot; the source/code hashes record exactly what was scored.

## Production decision

Leave the current model and 90% call gate unchanged. Keep this feature as a research candidate. Before reconsidering a probability-only change, freeze the candidate and score a new forward period with the same-market Open captured before Close. Require a stable paired gain over calibration alone and adequate coverage. Before enabling verified DP calls, separately demonstrate supported 90% precision on later outcomes. A same-day association at roughly 41%-42% does not satisfy that requirement.
