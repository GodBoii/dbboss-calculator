# Recent 30/180-Day Market Model Backtest

Actual results through **2026-07-23**. A hit requires both predicted digits to be absent from the actual panel.

## Strategy comparison

| Strategy | 180-day hits / n | Accuracy | Lift | p | 30-day hits / n | Accuracy | Lift | p |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline_v2 | 1865 / 3636 | 51.29% | +0.00 | 1.0000 | 309 / 610 | 50.66% | +0.00 | 1.0000 |
| static_market_side_pretest | 1859 / 3636 | 51.13% | -0.17 | 0.8711 | 299 / 610 | 49.02% | -1.64 | 0.4655 |
| rolling_market_side_causal | 1838 / 3636 | 50.55% | -0.74 | 0.3957 | 312 / 610 | 51.15% | +0.49 | 0.8763 |
| static_pretest_with_causal_kill_switch | 1878 / 3636 | 51.65% | +0.36 | 0.5481 | 309 / 610 | 50.66% | +0.00 | 1.0000 |
| promoted_guarded_market_v3 | 1888 / 3636 | 51.93% | +0.63 | 0.0865 | 311 / 610 | 50.98% | +0.33 | 0.7905 |

The static selector was trained entirely before the 180-day window. The rolling selector recomputes a guarded market-side choice using only earlier outcomes. The individual top-model lists below are same-window descriptions and cannot be used for promotion.

## Per-market comparison

| Market | 180d baseline | Static | Rolling | Guarded | V3 | 30d baseline | Static | Rolling | Guarded | V3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 53.09% | -5.06 | -4.21 | -0.56 | +0.00 | 56.67% | -11.67 | -8.33 | +0.00 | +0.00 |
| Time Bazar | 50.33% | +1.32 | -1.64 | -0.99 | +0.33 | 48.08% | +3.85 | +5.77 | +1.92 | +1.92 |
| Madhur Day | 51.40% | -3.09 | -3.93 | -1.12 | +0.00 | 53.33% | -10.00 | +5.00 | +0.00 | +0.00 |
| Milan Day | 52.30% | +0.66 | +1.97 | -0.33 | -0.33 | 44.23% | +1.92 | +9.62 | +0.00 | +0.00 |
| Rajdhani Day | 53.38% | +3.04 | +4.39 | +0.68 | +2.03 | 45.45% | +4.55 | +4.55 | +0.00 | +0.00 |
| Kalyan | 49.34% | +3.62 | +2.96 | +1.97 | +0.99 | 59.62% | +0.00 | -3.85 | -5.77 | -1.92 |
| Sridevi Night | 51.69% | -0.84 | -1.40 | +1.12 | +0.00 | 46.67% | -6.67 | +0.00 | -5.00 | +0.00 |
| Kalyan Night | 49.19% | +3.23 | +3.63 | +1.61 | +1.61 | 50.00% | +5.26 | +15.79 | +5.26 | +5.26 |
| Madhur Night | 52.96% | -6.91 | -6.58 | -2.30 | +0.00 | 57.69% | +3.85 | -1.92 | +0.00 | +0.00 |
| Milan Night | 47.02% | +2.32 | -1.66 | +0.33 | +0.00 | 40.38% | +7.69 | -3.85 | +5.77 | +0.00 |
| Rajdhani Night | 55.51% | -3.54 | -3.94 | -1.18 | +0.00 | 54.55% | -9.09 | -6.82 | +0.00 | +0.00 |
| Main Bazar | 48.81% | +5.95 | +3.97 | +6.35 | +3.97 | 50.00% | -4.55 | -6.82 | +0.00 | +0.00 |

## Market-side pretest selections

| Route | Model chosen before test | Train net | 180d lift | 30d lift | Recommendation |
| --- | --- | ---: | ---: | ---: | --- |
| Sridevi|open | `frequency_saturation_w60` | +11 | -7.87 | -20.00 | KEEP_BASELINE_TEST_REGRESSION |
| Sridevi|close | `calendar_same_year` | +11 | -2.25 | -3.33 | KEEP_BASELINE_TEST_REGRESSION |
| Time Bazar|open | `frequency_hot_w7` | +13 | -2.63 | -3.85 | KEEP_BASELINE_TEST_REGRESSION |
| Time Bazar|close | `lag_panel_repeat_15` | +12 | +5.26 | +11.54 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Madhur Day|open | `frequency_hot_w10` | +9 | -5.06 | -6.67 | KEEP_BASELINE_TEST_REGRESSION |
| Madhur Day|close | `frequency_saturation_w5` | +9 | -1.12 | -13.33 | KEEP_BASELINE_TEST_REGRESSION |
| Milan Day|open | `frequency_saturation_w90` | +18 | +0.66 | +0.00 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Milan Day|close | `frequency_hot_w5` | +6 | +0.66 | +3.85 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Rajdhani Day|open | `calendar_same_month` | +14 | +1.35 | -4.55 | KEEP_BASELINE_TEST_REGRESSION |
| Rajdhani Day|close | `lag_opposite_7` | +13 | +4.73 | +13.64 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Kalyan|open | `group_transition_signature` | +18 | +2.63 | -11.54 | KEEP_BASELINE_TEST_REGRESSION |
| Kalyan|close | `lag_jodi_transition_1` | +12 | +4.61 | +11.54 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Sridevi Night|open | `lag_sutta_transition_10` | +18 | -1.12 | -10.00 | KEEP_BASELINE_TEST_REGRESSION |
| Sridevi Night|close | `lag_sutta_transition_5` | +9 | -0.56 | -3.33 | KEEP_BASELINE_TEST_REGRESSION |
| Kalyan Night|open | `position_markov` | +13 | +1.61 | +0.00 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Kalyan Night|close | `frequency_saturation_w90` | +11 | +4.84 | +10.53 | OBSERVATIONAL_TWEAK_SHORTLIST |
| Madhur Night|open | `cross_source_sridevi` | +16 | -5.92 | +11.54 | KEEP_BASELINE_TEST_REGRESSION |
| Madhur Night|close | `frequency_saturation_w60` | +17 | -7.89 | -3.85 | KEEP_BASELINE_TEST_REGRESSION |
| Milan Night|open | `calendar_same_month` | +21 | +0.00 | +19.23 | KEEP_BASELINE_TEST_REGRESSION |
| Milan Night|close | `frequency_hot_w3` | +16 | +4.64 | -3.85 | KEEP_BASELINE_TEST_REGRESSION |
| Rajdhani Night|open | `frequency_saturation_w90` | +13 | -5.51 | -18.18 | KEEP_BASELINE_TEST_REGRESSION |
| Rajdhani Night|close | `sequence_two_sutta` | +18 | -1.57 | +0.00 | KEEP_BASELINE_TEST_REGRESSION |
| Main Bazar|open | `frequency_saturation_w30` | +19 | +3.97 | -9.09 | KEEP_BASELINE_TEST_REGRESSION |
| Main Bazar|close | `frequency_hot_w90` | +6 | +7.94 | +0.00 | OBSERVATIONAL_TWEAK_SHORTLIST |

## Descriptive top models: last180

| Rank | Model | Hits / n | Accuracy | Lift | Paired p |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `frequency_saturation_w30` | 1907 / 3636 | 52.45% | +1.16 | 0.2833 |
| 2 | `sequence_two_sutta` | 1904 / 3636 | 52.37% | +1.07 | 0.1581 |
| 3 | `calendar_season` | 1890 / 3636 | 51.98% | +0.69 | 0.3619 |
| 4 | `frequency_hot_w3` | 1889 / 3636 | 51.95% | +0.66 | 0.4438 |
| 5 | `interaction_saturation_opposite` | 1884 / 3636 | 51.82% | +0.52 | 0.5895 |
| 6 | `frequency_saturation_w90` | 1884 / 3636 | 51.82% | +0.52 | 0.5992 |
| 7 | `group_transition_signature` | 1883 / 3636 | 51.79% | +0.50 | 0.5813 |
| 8 | `lag_panel_repeat_15` | 1878 / 3636 | 51.65% | +0.36 | 0.6499 |
| 9 | `lag_absence_continue_15` | 1878 / 3636 | 51.65% | +0.36 | 0.6499 |
| 10 | `frequency_saturation_w15` | 1878 / 3636 | 51.65% | +0.36 | 0.7557 |

## Descriptive top models: last30

| Rank | Model | Hits / n | Accuracy | Lift | Paired p |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `sequence_two_sutta` | 328 / 610 | 53.77% | +3.11 | 0.0699 |
| 2 | `frequency_hot_w30` | 328 / 610 | 53.77% | +3.11 | 0.0871 |
| 3 | `frequency_hot_w10` | 327 / 610 | 53.61% | +2.95 | 0.1760 |
| 4 | `calendar_same_weekday_month` | 325 / 610 | 53.28% | +2.62 | 0.2471 |
| 5 | `frequency_hot_w7` | 324 / 610 | 53.11% | +2.46 | 0.2513 |
| 6 | `frequency_hot_w3` | 323 / 610 | 52.95% | +2.30 | 0.2786 |
| 7 | `frequency_hot_w2` | 323 / 610 | 52.95% | +2.30 | 0.2578 |
| 8 | `lag_panel_repeat_7` | 322 / 610 | 52.79% | +2.13 | 0.2672 |
| 9 | `lag_panel_repeat_2` | 322 / 610 | 52.79% | +2.13 | 0.2631 |
| 10 | `lag_absence_continue_7` | 322 / 610 | 52.79% | +2.13 | 0.2672 |

## Decision

Production changed: **true** to `absent-digits-guarded-market-routing-v3`.

User-directed guarded promotion. V3 applies only the eight routes that beat V2 in both windows and retains the causal kill switch. The aggregate lift is positive but not statistically confirmed, so the 80% actionability gate and V2 fallback remain mandatory.

Routes meeting both-window observational guards: Time Bazar|close, Milan Day|open, Milan Day|close, Rajdhani Day|close, Kalyan|close, Kalyan Night|open, Kalyan Night|close, Main Bazar|close.

Route tweaks surviving FDR correction: none.

The JSON artifact includes all candidate comparisons, per-route Open/Close results, selection histories, and every last-30-day hit/miss against actuals.
