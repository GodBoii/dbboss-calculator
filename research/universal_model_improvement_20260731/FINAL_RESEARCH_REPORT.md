# Deep model-improvement research: final decision

Date: 2026-07-31  
Scope: Open/Close sutta, Jodi, Open/Close Top-60 panels, two absent digits, two present digits, and SP/DP kind  
Production code changed: **No**

## 1. Executive decision

No researched challenger is ready to replace production.

The search found three market-local signals worth freezing as shadow models:

1. **Main Bazar Jodi:** combine `cold_w365` Open with the selected Close route. It beat production in each later block, including 3/5 versus 1/5 on July 24-30, but the samples are too small after testing 109 experts per side.
2. **Madhur Night Open sutta:** `transition_ensemble`. It tied production on the large April-June holdout, then gained 6 hits on July 1-23 and tied on July 24-30.
3. **Main Bazar Open sutta:** `cold_w365`. It tied on April-June and July 1-23, then gained 2 hits on July 24-30.

These are **shadow candidates, not production changes**. The broad market-routing model failed: Open lost 6 hits and Close lost 60 hits on the untouched April-June holdout. The encouraging July 24-30 aggregate rebound therefore cannot justify retroactive selection.

The independent panel test now has 110 rows, meeting its predeclared support minimum. Open challengers fell from the 50.9% production baseline to 43.6%; the best Close challenger rose from 29.1% to 32.7% but was not significant (`p=.5572`). No panel model is promoted.

## 2. Research architecture and leakage controls

- The exact production prediction path was exported for 3,021 market-date rows from 2025-10-01 through 2026-07-30.
- Every prediction used only records strictly earlier than its target date.
- Candidate selection used Q4 2025 discovery and Q1 2026 confirmation.
- April-June, July 1-23, and July 24-30 were untouched evaluation blocks.
- The search covered 109 causal sutta experts for Open and 109 for Close, including multiple windows, exponential decay, transitions, modular deltas, weekday/calendar effects, opposite and digit-house rules, panel positions, cross-market edges, and ensembles.
- Nominal paired McNemar tests are reported, but a result is not treated as family-wise significant after such a broad search without independent confirmation.
- Same-day cross-market features were kept separate from pre-day predictions because exact publication timestamps were unavailable.

## 3. Exact production baseline versus frozen routes

| Evaluation block | N | Open production | Open route | Close production | Close route | Jodi production | Jodi route |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Discovery: Q4 2025 | 882 | 65.1% | 69.6% | 60.3% | 71.3% | 39.2% | 50.2% |
| Confirmation: Q1 2026 | 899 | 65.1% | 66.9% | 63.1% | 65.3% | 42.0% | 44.5% |
| Untouched holdout: Apr-Jun | 932 | 67.9% | 67.3% | 68.5% | 62.0% | 47.0% | 42.1% |
| Recent: Jul 1-23 | 240 | 64.6% | 64.6% | 62.9% | 60.4% | 41.7% | 37.9% |
| Prospective: Jul 24-30 | 68 | 57.4% | 66.2% | 60.3% | 60.3% | 30.9% | 38.2% |

The frozen routes overfit discovery/confirmation and failed the larger untouched holdout. July 24-30 is useful directional evidence, not permission to ignore that failure.

## 4. Best recommendation for each market

“Production” means the current model remains the best deployable choice. A shadow route records predictions but does not affect the app.

| Market | Open sutta | Close sutta | Jodi | Exact panels | Absent/present digits | SP/DP |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Time Bazar | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Madhur Day | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Milan Day | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Rajdhani Day | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Kalyan | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Sridevi Night | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Kalyan Night | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Madhur Night | Production + shadow `transition_ensemble` | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Milan Night | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Rajdhani Night | Production | Production | Production | Production Top-60 | Production / research-only present pair | Production |
| Main Bazar | Production + shadow `cold_w365` | Production | Production + shadow combined route | Production Top-60 | Production / research-only present pair | Production |

No market-specific absent-digit or exact-panel challenger passed the complete promotion protocol.

## 5. Stable market-local shadow evidence

| Shadow candidate | Discovery | Confirmation | Apr-Jun holdout | Jul 1-23 | Jul 24-30 | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Madhur Night Open `transition_ensemble` | 48/72 vs 46/72 | 57/75 vs 50/75 | 45/78 vs 45/78 | 15/20 vs 9/20 | 5/6 vs 5/6 | Freeze prospectively |
| Main Bazar Open `cold_w365` | 45/61 vs 40/61 | 44/62 vs 42/62 | 40/64 vs 40/64 | 11/17 vs 11/17 | 4/5 vs 2/5 | Freeze prospectively |
| Main Bazar Jodi combined route | 34/61 vs 20/61 | 34/62 vs 27/62 | 24/64 vs 23/64 | 9/17 vs 5/17 | 3/5 vs 1/5 | Highest-priority shadow |

The later gains are attractive, but there are only 28 later Main Bazar calls and 26 later Madhur Night calls. With hundreds of route/expert comparisons, these rows do not establish a deployable edge.

## 6. Exact Open/Close panel research

### Frozen terminal and forward evidence

| Evaluation | Open Top-60 | Close pre-open Top-60 |
| --- | ---: | ---: |
| Original terminal holdout, 974 rows | 34.7% | 39.9% |
| Original post-cache forward, 150 rows | 39.3% | 36.7% |
| New independent prospective, 110 rows | 50.9% | 29.1% |

### New 110-row challenger comparison

| Task | Production learned | Hierarchical | Paired p | Contextual | Paired p | Selective coverage / hit rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Open | 56/110 (50.9%) | 48/110 (43.6%) | .0574 | 48/110 (43.6%) | .1516 | 87.3% / 53.1% |
| Close pre-open | 32/110 (29.1%) | 32/110 (29.1%) | 1.0000 | 36/110 (32.7%) | .5572 | 39.1% / 41.9% |

The panel family is overconfident: on the original terminal test, mean predicted Top-60 mass versus realized accuracy was 42.1% versus 34.7% for Open and 45.0% versus 39.9% for Close. The corresponding five-bin ECE values were 7.4% and 5.1%. Raw score mass must not be shown as a success probability.

The most consistently useful learned panel features were panel-kind profile, pair profile, lag-1 transition, recent/long frequency counts, position profile, and sparse overlap/opposite terms. Opposite digits, weekday identity, hot/cold panels, same-day cross-market relations, and low-rank neural models did not produce stable universal gains.

## 7. Two digits that will not come

The current complementary absent-digit model remains the deployable comparator. Across the frozen audit it achieved:

| Block | Accuracy |
| --- | ---: |
| Validation | 1224/2348 (52.13%) |
| Holdout | 1246/2466 (50.53%) |
| Recent | 1193/2300 (51.87%) |
| Independent extension | 53/88 (60.23%) |

The nested ridge challenger gained 1.66 percentage points on Holdout but missed paired significance (`p=.05389`) and then lost 5.68 points on the independent extension. The observational market routes gained only 0.63 points over 180 days (`p=.0865`). Of 110 named domain hypotheses, none passed all out-of-sample, FDR, route, and time-stability gates.

The strongest explanatory features were long-run digit rate, 730-draw rate, positional rates, short-window rates, weekday rate, and the existing V2 probability. Their coefficients are small and weakly stable. The promoted 240-event beta calibrator has Holdout Brier `0.2511`, ECE `2.50%`, and AUC `0.4849`; this does not support a high-confidence call. No market-side reaches an 80% Wilson lower bound, so abstention remains correct.

## 8. Two digits that will come

The best tested model is `joint_180`, but it is research-only:

| Evaluation | Both selected digits appeared |
| --- | ---: |
| Last 180 days | 226/3636 (6.22%) |
| Last 30 days | 44/610 (7.21%) |

No market-specific route was promoted. Joint 30/90/730 windows, marginal appearance, panel recency, weekday, sutta, SP/DP, Jodi transition, and other-side transfer all failed to improve stably. A 6-7% hit rate is not an actionable “will come” prediction and must remain clearly labeled as exploratory.

## 9. SP/DP panel-kind research

Raw accuracy can be raised mechanically by predicting the majority SP class:

| Side/model | Apr-Jun accuracy | Jul 1-23 | Jul 24-30 | Later DP recall |
| --- | ---: | ---: | ---: | ---: |
| Open production | 63.2% | 63.7% | 60.3% | 18.8%-23.0% |
| Open always-SP | 71.1% | 77.9% | 76.5% | **0%** |
| Close production | 70.4% | 65.0% | 75.0% | 15.4%-21.4% |
| Close DP-bias 1.90 | 75.8% | 72.5% | 79.4% | **0%-1.3%** |

These are diagnostic majority-class controls, not improvements. The balanced Open threshold raised DP recall but reduced overall accuracy from 63.2% to 51.1% on Holdout. The best balanced Close choice remained production. Production SP/DP should not change.

## 10. July 27-30 reality check

Across 44 completed market-date rows from 11 markets:

| Prediction | Exact production accuracy |
| --- | ---: |
| Open sutta Top-6 | 52.3% |
| Close sutta Top-6 | 61.4% |
| Jodi Top-36 | 29.5% |
| Open panel Top-60 | 38.6% |
| Close panel Top-60 | 36.4% |
| Open SP/DP kind | 59.1% |
| Close SP/DP kind | 65.9% |
| Open absent pair | 47.7% |
| Close absent pair | 50.0% |
| Open present pair | 6.8% |
| Close present pair | 2.3% |

Rajdhani Day had no accepted data in this four-day window. The full market-by-market table is in the dated backtest report.

## 11. Ranked findings and rejections

### Retain for frozen shadow measurement

1. Main Bazar Jodi combined route.
2. Madhur Night Open `transition_ensemble`.
3. Main Bazar Open `cold_w365`.
4. Existing absent-digit calibration and abstention policy.

### Reject for production

1. Broad Close market routing: large untouched-holdout reversal.
2. Broad Jodi routing: lost 46 hits on the untouched holdout and 9 on July 1-23.
3. Broad Open routing: no stable aggregate improvement.
4. Accuracy-first SP/DP thresholds: apparent gains came from suppressing DP recall.
5. Hierarchical/contextual panel challengers: failed terminal or independent confirmation.
6. Nested absent-digit ridge and observational routing: no significant, stable independent gain.
7. Present-pair model as an actionable call: only about 6-7% strict success.
8. Universal opposite, calendar, house, hot/cold, cross-market, and same-day rules: effects changed sign by market or period.

## 12. Failure analysis

- Top-6 sutta and Top-36 Jodi already cover 60% and 36% of the outcome space, so modest gains are easily produced by sampling noise.
- Searching many windows, markets, sources, and interactions makes the best historical edge an optimistic estimate.
- Cross-market correlations are especially vulnerable to schedule and publication-time ambiguity.
- Panel prediction is a 220-class ranking problem with weak stable signal.
- SP dominates DP, allowing misleading accuracy gains from majority-class prediction.
- Absent/present digit confidence has poor discrimination; calibration cannot create predictive information.
- The July prospective samples are small at the market level even when the pooled row count looks adequate.

## 13. Weaknesses and prioritized roadmap

1. Start a timestamped, append-only registry for the three shadow routes. Require at least 100 genuinely future calls per route and evaluate both total and worst-month lift.
2. Predeclare one primary metric per family: Top-K hit for sutta/panels, strict joint hit for Jodi/present pair, and balanced accuracy plus DP recall for SP/DP.
3. Apply Holm or Benjamini-Hochberg correction within each frozen hypothesis family.
4. Record exact result publication timestamps before using same-day market graph features.
5. Add regime-change alarms based on rolling paired lift, not automatic retuning.
6. Recalibrate panel probabilities on future-only rows; do not expose raw Top-60 mass as confidence.
7. Keep the absent-pair `NO_SAFE_CALL` gate and present-pair research-only label.
8. Revisit promotion only after an independent registry confirms the effect; do not select a route because July 24-30 happened to be favorable.

## 14. Reproducibility

```powershell
node research\universal_model_improvement_20260731\export_production_baseline.cjs 2025-10-01 2026-07-30
python research\universal_model_improvement_20260731\run_research.py
node research\panel_top60_prospective_v2\fetch_independent.cjs
python research\panel_top60_prospective_v2\score_frozen.py
python research\universal_model_improvement_20260731\verify_research.py
node scripts\weekly-production-backtest.cjs 2026-07-31 2026-07-27 2026-07-30
```

The detailed machine-readable results and per-call ledgers remain alongside this report. No file under `src` was modified.
