# Combined prediction experiment

Research only. Production code is unchanged.

Source dates: 2026-07-04 through 2026-09-30. 900 matched market-date events, all twelve markets and available weekends.

Development ends 2026-08-16; validation ends 2026-09-07; final audit is 2026-09-08 through 2026-09-30.
Event counts: {'development': 435, 'validation': 228, 'audit': 237}.

## Evidence limits

- Retrospective experiment. Historical periods have already been inspected in other studies.
- Current V2 Sutta and V3 absent routes were selected using some of these outcomes; later blocks are held out only from this study's combination search.
- Panel and DP model coefficient fitting ends before this study starts. Their coefficients are frozen, not refitted here.
- No production files, settings, or user-facing predictions are changed.
- The final block is evaluated only after selection.json is saved and hashed; it is never used to adjust multipliers or market routes.
- All panels are ranked before slicing. SP means exactly three distinct digits; TP is separate. DP list accuracy is reported both conditional on actual DP and across all events.

Intervals resample whole dates, 10,000 replicates. McNemar p-values compare paired discordant outcomes. Holm p-values adjust the 36 selected global/routed panel comparisons. Market rows and secondary derived outputs are descriptive.

## Final paired audit

SP/DP rates below are conditional on the actual panel type; all10/all30 rates use every event. Lists always have the requested number of unique legal panels.

| Channel | Task | Baseline | Selected | Net hits | Lift pp | Date-bootstrap 95% pp | Holm p |
|---|---|---:|---:|---:|---:|---|---:|
| open | all10 | 15/237 (6.3%) | 13/237 (5.5%) | -2 | -0.84 | [-4.89, +3.20] | 1.0000 |
| open | all30 | 47/237 (19.8%) | 41/237 (17.3%) | -6 | -2.53 | [-8.86, +4.64] | 1.0000 |
| open | sp30 | 47/170 (27.6%) | 41/170 (24.1%) | -6 | -3.53 | [-12.88, +6.40] | 1.0000 |
| open | dp10 | 10/65 (15.4%) | 6/65 (9.2%) | -4 | -6.15 | [-15.00, +3.08] | 1.0000 |
| open | dp20 | 20/65 (30.8%) | 20/65 (30.8%) | +0 | +0.00 | [+0.00, +0.00] | 1.0000 |
| open | dp30 | 27/65 (41.5%) | 28/65 (43.1%) | +1 | +1.54 | [-12.50, +15.25] | 1.0000 |
| close_pre | all10 | 11/237 (4.6%) | 15/237 (6.3%) | +4 | +1.69 | [-0.88, +4.58] | 1.0000 |
| close_pre | all30 | 46/237 (19.4%) | 45/237 (19.0%) | -1 | -0.42 | [-2.35, +1.33] | 1.0000 |
| close_pre | sp30 | 51/186 (27.4%) | 47/186 (25.3%) | -4 | -2.15 | [-5.23, +1.12] | 1.0000 |
| close_pre | dp10 | 10/51 (19.6%) | 9/51 (17.6%) | -1 | -1.96 | [-21.15, +14.04] | 1.0000 |
| close_pre | dp20 | 13/51 (25.5%) | 12/51 (23.5%) | -1 | -1.96 | [-16.67, +13.46] | 1.0000 |
| close_pre | dp30 | 16/51 (31.4%) | 18/51 (35.3%) | +2 | +3.92 | [-12.82, +19.15] | 1.0000 |
| close_known | all10 | 16/237 (6.8%) | 19/237 (8.0%) | +3 | +1.27 | [-2.35, +5.06] | 1.0000 |
| close_known | all30 | 45/237 (19.0%) | 51/237 (21.5%) | +6 | +2.53 | [-3.15, +7.84] | 1.0000 |
| close_known | sp30 | 45/186 (24.2%) | 51/186 (27.4%) | +6 | +3.23 | [-3.92, +10.11] | 1.0000 |
| close_known | dp10 | 10/51 (19.6%) | 11/51 (21.6%) | +1 | +1.96 | [-11.63, +14.00] | 1.0000 |
| close_known | dp20 | 16/51 (31.4%) | 15/51 (29.4%) | -1 | -1.96 | [-23.40, +16.67] | 1.0000 |
| close_known | dp30 | 25/51 (49.0%) | 23/51 (45.1%) | -2 | -3.92 | [-17.65, +8.70] | 1.0000 |

## Market-specific adjustments

Only routes passing the frozen development and validation guards are applied. The table includes every task with an active route, including regressions. SP30 and all30 sometimes contain the same panels, so their gains are not independent evidence.

| Channel | Task | Baseline | Global combination | With market routes | Routed lift pp | Date-bootstrap 95% pp | Paired p / Holm p |
|---|---|---:|---:|---:|---:|---|---|
| open | all30 | 47/237 | 41/237 | 43/237 | -1.69 | [-7.87, +4.89] | 0.6655 / 1.0000 |
| open | sp30 | 47/170 | 41/170 | 43/170 | -2.35 | [-11.24, +6.67] | 0.6655 / 1.0000 |
| close_pre | all10 | 11/237 | 15/237 | 14/237 | +1.27 | [-1.19, +3.80] | 0.5488 / 1.0000 |
| close_pre | all30 | 46/237 | 45/237 | 45/237 | -0.42 | [-2.31, +1.33] | 1.0000 / 1.0000 |
| close_known | all10 | 16/237 | 19/237 | 18/237 | +0.84 | [-3.14, +4.82] | 0.8318 / 1.0000 |
| close_known | all30 | 45/237 | 51/237 | 59/237 | +5.91 | [+0.40, +11.42] | 0.0649 / 1.0000 |
| close_known | sp30 | 45/186 | 51/186 | 59/186 | +7.53 | [+0.51, +14.72] | 0.0649 / 1.0000 |

## Interpretation

The routed known-Open Close Top-30 policy is the strongest candidate in this run. It gains 18 development hits, 6 validation hits, and 14 final-audit hits. Final accuracy rises from 45/237 to 59/237 across all Close outcomes, and from 45/186 to 59/186 conditional on SP. Its date-bootstrap interval is positive, but the paired p-value is about .065 and no selected panel comparison survives Holm adjustment. Treat it as a candidate for a new frozen extension, not a confirmed production improvement.

The same policy uses a global Sutta correction of 0.25 and appearance residual weight -0.5. Kalyan Night instead uses appearance 0.25 and an avoided-digit multiplier of 1.25. Madhur Day uses Sutta -0.125, appearance -0.5, and a present-digit multiplier of 1.25. A negative appearance residual weight reverses the adjustment relative to what the base panel model already expects; it does not assert that every likely digit should be avoided.

Open combinations largely fail the final block. Known-Open Close Top-10 and DP Top-10 retain small gains. Before-Open Close DP Top-30 gains in all three blocks, but only two final DP hits. Jodi-25 conditioning loses six final hits, while the 36-pair selection retains the existing grid. Derived Close absent pairs improve, but Open absent pairs regress. There is no shared multiplier that improves every output.

No production change is recommended from this experiment alone. The retained candidate is fully specified in selection.json and can be scored unchanged on later, previously unused chart dates.

## Frozen multipliers and earlier-block results

Avoid multipliers apply per distinct predicted-absent digit present in a panel. Present multipliers apply per predicted-present digit contained in a panel. Sutta/appearance/conditional weights are powers of probability ratios. DP blend 1 uses the dedicated DP distribution within the original DP mass; it does not predict that a DP will occur.

### open

Configurations evaluated on development: 433.

| Task | Weights | Development baseline / selected | Validation baseline / selected | Routed markets |
|---|---|---|---|---|
| all10 | `sutta=0;appearance=0.25;avoid_multiplier=0.75;present_multiplier=1;dp_blend=0;conditional_close=0` | 7.8% / 8.5% | 8.8% / 10.1% | none |
| all30 | `sutta=0;appearance=1;avoid_multiplier=1;present_multiplier=1;dp_blend=0.5;conditional_close=0` | 21.6% / 23.9% | 18.4% / 21.5% | Kalyan Night, Rajdhani Day, Time Bazar |
| sp30 | `sutta=0;appearance=1;avoid_multiplier=1;present_multiplier=1;dp_blend=0.5;conditional_close=0` | 28.4% / 31.4% | 24.9% / 29.0% | Kalyan Night, Rajdhani Day, Time Bazar |
| dp10 | `sutta=0.25;appearance=0.25;avoid_multiplier=1.16183;present_multiplier=1.25;dp_blend=0;conditional_close=0` | 15.5% / 15.5% | 10.3% / 19.0% | none |
| dp20 | `sutta=0;appearance=0;avoid_multiplier=1;present_multiplier=1;dp_blend=1;conditional_close=0` | 32.0% / 32.0% | 27.6% / 27.6% | none |
| dp30 | `sutta=0.25;appearance=0.125;avoid_multiplier=1;present_multiplier=1;dp_blend=1;conditional_close=0` | 45.6% / 45.6% | 32.8% / 36.2% | none |
### close_pre

Configurations evaluated on development: 546.

| Task | Weights | Development baseline / selected | Validation baseline / selected | Routed markets |
|---|---|---|---|---|
| all10 | `sutta=0;appearance=-0.5;avoid_multiplier=1.16183;present_multiplier=1.25;dp_blend=0;conditional_close=0` | 6.0% / 6.4% | 6.1% / 7.0% | Kalyan |
| all30 | `sutta=0;appearance=-0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=0;conditional_close=0` | 18.2% / 18.4% | 15.4% / 17.5% | Madhur Day |
| sp30 | `sutta=0;appearance=-0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=0;conditional_close=0.5` | 24.8% / 26.3% | 21.3% / 24.4% | none |
| dp10 | `sutta=2;appearance=0.125;avoid_multiplier=1;present_multiplier=1;dp_blend=0;conditional_close=0.25` | 3.9% / 11.7% | 14.3% / 15.9% | none |
| dp20 | `sutta=0;appearance=0;avoid_multiplier=1.25;present_multiplier=1;dp_blend=1;conditional_close=0.125` | 11.7% / 20.4% | 23.8% / 27.0% | none |
| dp30 | `sutta=-0.5;appearance=0;avoid_multiplier=1.16183;present_multiplier=1;dp_blend=1;conditional_close=0` | 26.2% / 35.9% | 36.5% / 44.4% | none |
### close_known

Configurations evaluated on development: 505.

| Task | Weights | Development baseline / selected | Validation baseline / selected | Routed markets |
|---|---|---|---|---|
| all10 | `sutta=0.25;appearance=0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=1;conditional_close=0` | 6.4% / 7.4% | 7.9% / 8.8% | Main Bazar |
| all30 | `sutta=0.25;appearance=-0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=0;conditional_close=0` | 18.6% / 21.1% | 20.2% / 21.5% | Kalyan Night, Madhur Day |
| sp30 | `sutta=0.25;appearance=-0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=0;conditional_close=0` | 24.5% / 27.8% | 28.0% / 29.9% | Kalyan Night, Madhur Day |
| dp10 | `sutta=0;appearance=-0.5;avoid_multiplier=1;present_multiplier=1;dp_blend=0.25;conditional_close=0` | 5.8% / 12.6% | 12.7% / 22.2% | none |
| dp20 | `sutta=0;appearance=0;avoid_multiplier=1.25;present_multiplier=1;dp_blend=0;conditional_close=0` | 21.4% / 23.3% | 30.2% / 34.9% | none |
| dp30 | `sutta=0;appearance=0;avoid_multiplier=1;present_multiplier=1;dp_blend=0.25;conditional_close=0` | 27.2% / 33.0% | 39.7% / 44.4% | none |

## Derived predictions from the all30 policy

These use summed panel probabilities. Controls are the current Sutta rankings, current present/absent pairs, and always-SP for panel kind. They were not independently tuned on the audit block.

| Channel | Output | Control | Combined | Lift pp |
|---|---|---:|---:|---:|
| open | sutta3 | 68/237 | 73/237 | +2.11 |
| open | sutta6 | 143/237 | 143/237 | +0.00 |
| open | present2 | 8/237 | 12/237 | +1.69 |
| open | absent2 | 120/237 | 104/237 | -6.75 |
| open | kind | 170/237 | 170/237 | +0.00 |
| close_pre | sutta3 | 79/237 | 72/237 | -2.95 |
| close_pre | sutta6 | 151/237 | 137/237 | -5.91 |
| close_pre | present2 | 14/237 | 11/237 | -1.27 |
| close_pre | absent2 | 104/237 | 122/237 | +7.59 |
| close_pre | kind | 186/237 | 186/237 | +0.00 |
| close_known | sutta3 | 79/237 | 80/237 | +0.42 |
| close_known | sutta6 | 151/237 | 141/237 | -4.22 |
| close_known | present2 | 14/237 | 20/237 | +2.53 |
| close_known | absent2 | 104/237 | 125/237 | +8.86 |
| close_known | kind | 186/237 | 186/237 | +0.00 |

## Jodi

The control is the production 5x5 or 6x6 grid. The challenger ranks all 100 pairs using marginal rank ratings plus the smoothed historical Open-to-Close distribution. A null selected weight keeps the existing grid.

| Pairs | Conditional weight | Grid | Selected | Lift pp |
|---|---|---:|---:|---:|
| 25 | 1 | 59/237 | 53/237 | -2.53 |
| 36 | None | 89/237 | 89/237 | +0.00 |

## Reproduce

```powershell
node research/combined_prediction_v1/export_replay.cjs
python research/combined_prediction_v1/run_experiment.py select
python research/combined_prediction_v1/run_experiment.py evaluate
python research/combined_prediction_v1/verify_experiment.py
```

The exporter reads the tracked frozen CSV, calls current production functions with strictly prior dates, and uses checked in-memory adapters to expose full orders/raw logits. It performs no network requests. Before-Open Close probabilities use softmax(-rank/40) to preserve the public heuristic order; they are not calibrated probabilities. Raw replay is regenerable and ignored by Git.

Frozen selection SHA-256: `951bb8ebc53fd9b6ff41af377871d48a1855cb02937725de9d0e18233126af73`.

Full development search: search_development.csv. Family comparisons and market routes: selection.json. Per-market audit and paired counts: results.json. Exact selected final-block calls: audit_calls.csv.
