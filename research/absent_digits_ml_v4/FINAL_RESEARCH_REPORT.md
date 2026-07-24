# Absent-Digits Prediction Engine: Final Research Report

Date: 2026-07-24

## Executive decision

The scientifically supported comparator is `absent-digits-complementary-online-v2`. Following an explicit user-directed decision on 2026-07-25, the guarded `absent-digits-guarded-market-routing-v3` model is the app default.

- V2 combines a digit-appearance model with a direct pair-absence model at the validation-selected 75/25 weight.
- The complete domain study tested 110 named hypotheses; zero survived all out-of-sample, FDR, route, and time-stability gates.
- The observational V3 routes improved the inspected 180-day aggregate by 0.63 percentage points, but the paired result was not significant (`p=.0865`) and no route survived FDR. V3 is deployed by user direction with automatic V2 fallback; this caveat remains controlling.
- A new nested chronological ridge family improved Validation, Holdout, and Recent, but failed paired confirmation (`p=.0579`) and worst-route stability. It was rejected.
- No market-side supports the requested 80% Wilson lower confidence bound. The runtime correctly emits `NO_SAFE_CALL` while still exposing research candidates and per-digit probabilities.

## 1. Current architecture

1. Historical Open/Close panels are normalized, date-deduplicated, and cut off strictly before the target date.
2. Model A estimates each digit's appearance probability from long, 30/90-draw, weekday, and previous-panel-state experts.
3. Model B directly estimates every absent pair from long, 30/90-draw, weekday, and transition experts.
4. Each family updates expert weights prequentially with an exponentially weighted Brier loss; V2 blends Model A and B 75/25.
5. The two digits with the strongest blended absence evidence become the candidate; the five highest appearance probabilities are also returned.
6. Point confidence uses the promoted 240-event, strength-80 beta calibrator. Actionability remains controlled by an independent 120-event Wilson lower bound and a 30-event minimum.
7. The UI receives per-digit appearance/absence probabilities, model contributors, agreement, reliability, confidence interval, and call/abstain status.

## 2. Frozen V2 baseline

| Block | Hits / N | Strict accuracy | Random reference | Macro | Worst market-side |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 1224/2348 | 52.13% | 50.52% | 52.19% | 39.67% |
| Holdout | 1246/2466 | 50.53% | 50.60% | 50.46% | 41.75% |
| Recent | 1193/2300 | 51.87% | 50.85% | 51.84% | 45.26% |
| Post Cache | 132/288 | 45.83% | 50.02% | 45.83% | 8.33% |
| Independent Extension | 53/88 | 60.23% | 52.35% | 60.23% | 25.00% |

## 3. Candidate improvement comparison

| Candidate | Evaluation | Candidate | V2 | Lift | Paired p | Decision |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Observational V3 | Last 180 days | 1888/3636 (51.93%) | 1865/3636 (51.29%) | +0.63 pp | 0.08646 | Research-only |
| Observational V3 | Last 30 days | 311/610 (50.98%) | 309/610 (50.66%) | +0.33 pp | 0.7905 | Research-only |
| Nested ridge | Holdout | 1287/2466 (52.19%) | 1246/2466 (50.53%) | +1.66 pp | 0.05389 | Rejected |
| Nested ridge | Independent Extension | 48/88 (54.55%) | 53/88 (60.23%) | -5.68 pp | 0.4049 | Rejected |
| Nested ridge | Post Cache | 140/288 (48.61%) | 132/288 (45.83%) | +2.78 pp | 0.302 | Rejected |
| Nested ridge | Recent | 1210/2300 (52.61%) | 1193/2300 (51.87%) | +0.74 pp | 0.462 | Rejected |
| Nested ridge | Validation | 1235/2348 (52.60%) | 1224/2348 (52.13%) | +0.47 pp | 0.614 | Rejected |

## 4. Market-wise confirmation comparison

The table aggregates Open and Close for the nested model after it was selected entirely before Validation. Positive rows remain exploratory because the family failed its global promotion gate.

| Market | N | V2 | Nested ridge | Lift | Production model |
| --- | ---: | ---: | ---: | ---: | --- |
| Kalyan | 624 | 314/624 (50.32%) | 302/624 (48.40%) | -1.92 pp | V2 |
| Kalyan Night | 512 | 258/512 (50.39%) | 276/512 (53.91%) | +3.52 pp | V2 |
| Madhur Day | 724 | 374/724 (51.66%) | 375/724 (51.80%) | +0.14 pp | V2 |
| Madhur Night | 624 | 334/624 (53.53%) | 321/624 (51.44%) | -2.08 pp | V2 |
| Main Bazar | 520 | 257/520 (49.42%) | 260/520 (50.00%) | +0.58 pp | V2 |
| Milan Day | 622 | 326/622 (52.41%) | 326/622 (52.41%) | +0.00 pp | V2 |
| Milan Night | 616 | 297/616 (48.21%) | 314/616 (50.97%) | +2.76 pp | V2 |
| Rajdhani Day | 616 | 325/616 (52.76%) | 342/616 (55.52%) | +2.76 pp | V2 |
| Rajdhani Night | 522 | 278/522 (53.26%) | 286/522 (54.79%) | +1.53 pp | V2 |
| Sridevi | 744 | 401/744 (53.90%) | 412/744 (55.38%) | +1.48 pp | V2 |
| Sridevi Night | 744 | 363/744 (48.79%) | 373/744 (50.13%) | +1.34 pp | V2 |
| Time Bazar | 622 | 321/622 (51.61%) | 333/622 (53.54%) | +1.93 pp | V2 |

## 5. Best model and feature evidence by market-side

No market-specific challenger passed the full promotion protocol, so V2 remains the best deployable model for every row. The listed ML feature is the strongest standardized local coefficient and is explanatory, not a promotion.

| Market-side | Deployable model | Exploratory top feature | ML lift |
| --- | --- | --- | ---: |
| Kalyan Night|close | V2 | `rate_730` | +2.34 pp |
| Kalyan Night|open | V2 | `rate_730` | +4.69 pp |
| Kalyan|close | V2 | `long_rate` | -3.53 pp |
| Kalyan|open | V2 | `long_rate` | -0.32 pp |
| Madhur Day|close | V2 | `digit_0` | -1.10 pp |
| Madhur Day|open | V2 | `position_2_long` | +1.38 pp |
| Madhur Night|close | V2 | `position_2_long` | -3.85 pp |
| Madhur Night|open | V2 | `position_2_long` | -0.32 pp |
| Main Bazar|close | V2 | `digit_1` | +3.08 pp |
| Main Bazar|open | V2 | `long_rate` | -1.92 pp |
| Milan Day|close | V2 | `position_1_long` | -0.96 pp |
| Milan Day|open | V2 | `long_rate` | +0.96 pp |
| Milan Night|close | V2 | `position_1_long` | +2.27 pp |
| Milan Night|open | V2 | `long_rate` | +3.25 pp |
| Rajdhani Day|close | V2 | `position_2_long` | +2.92 pp |
| Rajdhani Day|open | V2 | `position_2_90` | +2.60 pp |
| Rajdhani Night|close | V2 | `long_rate` | -1.15 pp |
| Rajdhani Night|open | V2 | `long_rate` | +4.21 pp |
| Sridevi Night|close | V2 | `long_rate` | +1.08 pp |
| Sridevi Night|open | V2 | `long_rate` | +1.61 pp |
| Sridevi|close | V2 | `position_1_long` | +1.34 pp |
| Sridevi|open | V2 | `position_2_long` | +1.61 pp |
| Time Bazar|close | V2 | `rate_730` | +2.89 pp |
| Time Bazar|open | V2 | `long_rate` | +0.96 pp |

## 6. Global feature importance

Absolute standardized ridge coefficients for the frozen pooled component:

| Rank | Feature | Importance |
| ---: | --- | ---: |
| 1 | `long_rate` | 0.023750 |
| 2 | `rate_730` | 0.020796 |
| 3 | `position_2_long` | 0.016722 |
| 4 | `position_2_90` | 0.013859 |
| 5 | `digit_0` | 0.009303 |
| 6 | `v2_probability` | 0.008476 |
| 7 | `position_0_90` | 0.008449 |
| 8 | `position_1_90` | 0.005970 |
| 9 | `rate_2` | 0.005528 |
| 10 | `digit_9` | 0.005254 |
| 11 | `weekday_rate` | 0.004656 |
| 12 | `digit_4` | 0.004517 |
| 13 | `rate_60` | 0.004507 |
| 14 | `digit_1` | 0.004480 |
| 15 | `rate_90` | 0.004380 |

## 7. Ranked successful findings

1. **75/25 complementary formulation retained.** Validation selected the appearance/direct-absence blend. Its selection is still uncertain (53.2% bootstrap frequency), so it is preserved rather than overstated.
2. **240-event beta confidence calibration promoted.** It improved Brier loss on Validation and both confirmation/later comparisons while leaving the independent Wilson safety gate unchanged.
3. **Causal isolation and runtime parity proven.** Target/future-row contamination tests, 24 market-side registry parity, hashes, and minimum history enforcement pass.
4. **Abstention retained.** No candidate has evidence for an 80% lower bound, so forcing calls would reduce reliability.

No domain-specific predictive hypothesis earned production promotion.

## 8. Ranked rejected hypotheses and families

| Rank | Candidate | Best observed evidence | Rejection reason |
| ---: | --- | --- | --- |
| 1 | `frequency_saturation_w90` | Holdout +2.27 pp; Recent -0.17 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 2 | `calendar_season` | Holdout +1.62 pp; Recent +0.30 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 3 | `frequency_saturation_w30` | Holdout +1.87 pp; Recent +0.04 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 4 | `sequence_two_sutta` | Holdout +1.34 pp; Recent +0.57 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 5 | `interaction_saturation_opposite` | Holdout +1.42 pp; Recent +0.43 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 6 | `position_order_pattern` | Holdout +1.46 pp; Recent +0.26 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 7 | `calendar_same_month` | Holdout +1.66 pp; Recent +0.00 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 8 | `lag_panel_repeat_2` | Holdout +1.70 pp; Recent -0.17 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 9 | `lag_absence_continue_2` | Holdout +1.70 pp; Recent -0.17 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 10 | `hmm_three_state_sutta` | Holdout +1.46 pp; Recent +0.00 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 11 | `group_transition_signature` | Holdout +1.58 pp; Recent -0.13 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 12 | `lag_jodi_transition_2` | Holdout +1.09 pp; Recent +0.26 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 13 | `auto_warmup_cross_source_selector` | Holdout +1.78 pp; Recent -0.57 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 14 | `symbolic_previous_sum` | Holdout +1.50 pp; Recent -0.30 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 15 | `lag_panel_repeat_15` | Holdout +1.46 pp; Recent -0.30 pp | Failed one or more validation, FDR, later, route, or month-stability gates |
| 16 | Nested ridge `hierarchical_ridge10p0_blend0p25` | Confirmation paired `p=.0579` | Not significant; worst route -6.53 pp |
| 17 | Observational V3 route set | +0.63 pp over 180 days | Post-selection, `p=.0865`, zero FDR-confirmed routes |

## 9. Confidence calibration

Promoted point estimator: `local_beta_w240_s80`.

| Block | Observed | Mean predicted | Brier | ECE | AUC |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 52.13% | 51.64% | 0.2497 | 0.82% | 0.5086 |
| Holdout | 50.53% | 51.31% | 0.2511 | 2.50% | 0.4849 |
| Recent | 51.87% | 51.12% | 0.2502 | 1.72% | 0.4988 |
| Post Cache | 45.83% | 51.01% | 0.2506 | 5.46% | 0.5179 |
| Independent Extension | 60.23% | 50.90% | 0.2504 | 9.94% | 0.4730 |

## 10. Failure analysis

- Strict accuracy remains near the combinatorial random reference in the large blocks; apparent short-window lifts are small relative to noise.
- Cross-market, opposite, rotation, house, calendar, streak, HMM, association, and sequence effects change across chronology and routes.
- Market-specific selection overfits small samples: V2 local routing won Validation significantly but did not retain its advantage later.
- V3's shortlist was chosen after viewing recent windows; its apparent lift is not independent confirmation.
- Nested ridge improved average Brier loss and several aggregates, but market-side losses reached 6.53 points and its paired confirmation just missed the preregistered threshold.
- Confidence has weak discrimination (AUC close to .5), so high model scores cannot be interpreted as high hit probability.

## 11. Research journal

| Cycle | Experiment | Result | Decision |
| ---: | --- | --- | --- |
| 1 | Exact V2 baseline replay | Metrics reproduced across five blocks | Freeze comparator |
| 2 | Appearance/absence blend grid | 75/25 selected; bootstrap-uncertain | Retain conservatively |
| 3 | Dynamic expert weighting ablation | Alternative weighting failed later gates | Retain EMA baseline |
| 4 | Feature ablation | Validation winner regressed later | Reject |
| 5 | Exact-panel residual model | Failed promotion | Reject |
| 6 | Local blend routing | Validation gain vanished later | Reject |
| 7 | Selective confidence/agreement gates | Failed confirmation and 80% bound | Reject |
| 8 | Confidence calibration (44 estimators) | 240/80 beta improved Brier robustly | Promote point calibration |
| 9 | Domain hypothesis library | 110 tested, 0 retained | Reject all |
| 10 | Recent static/rolling/guarded routing | Small non-significant lift | Research-only, rollback default |
| 11 | Nested ridge (48 configs, 47 features) | Positive major-block lift; failed significance/stability | Reject |

## 12. Forward evidence status

- Frozen cohorts: 1.
- Pending market-side outcomes: 24.
- Safe calls frozen: 0; scored: 0.
- Historical blocks are now inspected. New model-family claims require a hash-frozen prospective cohort; re-mining the same rows is exploratory.

## 13. Remaining weaknesses

- Outcome history alone contains little stable predictive information.
- The independent extension is small, producing wide uncertainty.
- Publication timestamps are approximated from schedules rather than observed event timestamps.
- Holiday metadata is incomplete and geography labels are absent.
- Model A and Model B are complementary formulations but not statistically independent because both use the same outcome history.
- The 80% target is unsupported; current safe behavior is abstention.

## 14. Prioritized roadmap

1. Score cohort 001 without restarts or omissions, then register cohort 002 only after every pending row is resolved.
2. Freeze the nested ridge candidate as a shadow model—not production—and compare it prospectively against V2.
3. Add authoritative per-event publication timestamps before using same-day cross-market inputs.
4. Add genuinely new lawful pre-draw covariates; more transformations of the same outcome history are unlikely to supply independent signal.
5. Reassess only at preregistered sample checkpoints with paired tests, route stability, calibration, and multiplicity control.

## Reproduction

```powershell
python research/absent_digits_v2/run_research.py
python research/absent_digits_hypotheses_v3/run_hypothesis_research.py
python research/absent_digits_ml_v4/run_nested_ml.py
npm run verify:absent-digits
npm run verify:absent-digits-runtime
npm run verify:absent-digits-v3-runtime
npm run verify:absent-digits-v3-backtest
npm run verify:absent-digits-ml
npm run lint
npm run build
```
