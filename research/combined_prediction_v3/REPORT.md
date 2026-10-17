# Combined prediction V3: unused soft present-digit signal and DP kind-mass control

Research only. Production code, settings and predictions are unchanged.

Baseline: the frozen production policy `combined-weighted-v1` (`src/lib/combined-policy.ts`). Replays: 1052 market-date events, July 4 - October 15, 2026. Blocks: development 435, validation 228, audit 237, October extension 152.

## What is new in this study

- `present_soft`: the production present-digit model's soft per-digit appearance probabilities. The V1 exporter stored them (`presentAppearance`) but no candidate in combined_prediction_v1 or v2 ever used them; production only uses the hard `predictedDigits` list.
- `kind_tilt`: an explicit log multiplier on the DP panel-kind mass. The production `dp_blend` only redistributes probability inside the DP kind and never changes the SP/DP mass split.
- All candidates are scored against the actual production policy, not the uncombined inputs that combined_prediction_v1 used as its baseline.

## Evidence limits

- Retrospective experiment on previously inspected dates. The production policy was selected on development/validation/audit blocks by combined_prediction_v1.
- The October extension was used by combined_prediction_v2 to select different candidates; it is only semi-fresh for the new candidates defined here, which were never fitted or selected on it.
- Panel and DP model coefficients are frozen production code; they are not refitted here.
- No production files, settings, or user-facing predictions are changed.
- SP/DP rates are conditional on the actual panel type; all10/all30 rates use every event.
- The soft present-digit probabilities were exported by combined_prediction_v1 and never used by any candidate in v1 or v2.

## Frozen selections and their block results

Selection used development only, then validation; the audit and October columns below were produced after selection.json was hashed. `production` means no candidate survived the development guard.

| Kind | Channel | Endpoint | Task | Selected change | Development | Validation | Audit | October extension |
|---|---|---|---|---|---|---|---|---|
| panel | open | all10 | all10 | `production` | 37/435 | 23/228 | 13/237 -> 13/237 (5.5% -> 5.5%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 18/152 -> 18/152 (11.8% -> 11.8%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | open | sp30 | sp30 | `production` | 119/331 | 57/169 | 43/170 -> 43/170 (25.3% -> 25.3%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 36/115 -> 36/115 (31.3% -> 31.3%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | open | dp20 | dp20 | `production` | 33/103 | 16/58 | 20/65 -> 20/65 (30.8% -> 30.8%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 8/37 -> 8/37 (21.6% -> 21.6%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| derived | open | sp30 | sutta6 | `present_soft=2;kind_tilt=-1` | 271/435 | 147/228 | 144/237 -> 137/237 (60.8% -> 57.8%, lift -2.95 pp, 95% [-7.79, +1.83], p=0.3817) | 98/152 -> 94/152 (64.5% -> 61.8%, lift -2.63 pp, 95% [-9.66, +4.83], p=0.5966) |
| derived | open | sp30 | present2 | `present_soft=2` | 35/435 | 18/228 | 12/237 -> 9/237 (5.1% -> 3.8%, lift -1.27 pp, 95% [-4.22, +1.69], p=0.6072) | 10/152 -> 17/152 (6.6% -> 11.2%, lift +4.61 pp, 95% [-0.62, +9.15], p=0.0923) |
| derived | open | sp30 | absent2 | `kind_tilt=0.25` | 229/435 | 136/228 | 100/237 -> 103/237 (42.2% -> 43.5%, lift +1.27 pp, 95% [+0.00, +2.74], p=0.2500) | 74/152 -> 74/152 (48.7% -> 48.7%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | close_pre | all10 | all10 | `kind_tilt=-0.5` | 33/435 | 18/228 | 14/237 -> 14/237 (5.9% -> 5.9%, lift +0.00 pp, 95% [-1.23, +1.27], p=1.0000) | 11/152 -> 11/152 (7.2% -> 7.2%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | close_pre | sp30 | sp30 | `production` | 87/331 | 40/164 | 47/186 -> 47/186 (25.3% -> 25.3%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 28/111 -> 28/111 (25.2% -> 25.2%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | close_pre | dp20 | dp20 | `present_soft=-1` | 22/103 | 18/63 | 12/51 -> 12/51 (23.5% -> 23.5%, lift +0.00 pp, 95% [-20.41, +17.54], p=1.0000) | 10/41 -> 10/41 (24.4% -> 24.4%, lift +0.00 pp, 95% [-15.01, +15.79], p=1.0000) |
| derived | close_pre | sp30 | sutta6 | `present_soft=-2;kind_tilt=-1` | 259/435 | 155/228 | 136/237 -> 144/237 (57.4% -> 60.8%, lift +3.38 pp, 95% [-2.70, +9.72], p=0.2559) | 81/152 -> 89/152 (53.3% -> 58.6%, lift +5.26 pp, 95% [-0.59, +10.87], p=0.1849) |
| derived | close_pre | sp30 | present2 | `present_soft=-2;kind_tilt=-0.25` | 27/435 | 13/228 | 10/237 -> 15/237 (4.2% -> 6.3%, lift +2.11 pp, 95% [+0.00, +4.57], p=0.1797) | 12/152 -> 9/152 (7.9% -> 5.9%, lift -1.97 pp, 95% [-6.96, +2.72], p=0.5078) |
| derived | close_pre | sp30 | absent2 | `present_soft=-1;kind_tilt=0.25` | 217/435 | 122/228 | 118/237 -> 116/237 (49.8% -> 48.9%, lift -0.84 pp, 95% [-4.58, +2.85], p=0.8318) | 77/152 -> 73/152 (50.7% -> 48.0%, lift -2.63 pp, 95% [-10.79, +4.67], p=0.4807) |
| panel | close_known | all10 | all10 | `production` | 39/435 | 21/228 | 18/237 -> 18/237 (7.6% -> 7.6%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 6/152 -> 6/152 (3.9% -> 3.9%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | close_known | sp30 | sp30 | `production` | 99/331 | 52/164 | 59/186 -> 59/186 (31.7% -> 31.7%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 30/111 -> 30/111 (27.0% -> 27.0%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| panel | close_known | dp20 | dp20 | `production` | 24/103 | 22/63 | 15/51 -> 15/51 (29.4% -> 29.4%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 9/41 -> 9/41 (22.0% -> 22.0%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| derived | close_known | sp30 | sutta6 | `present_soft=-0.5` | 260/435 | 154/228 | 141/237 -> 142/237 (59.5% -> 59.9%, lift +0.42 pp, 95% [-1.35, +2.22], p=1.0000) | 93/152 -> 92/152 (61.2% -> 60.5%, lift -0.66 pp, 95% [-2.88, +1.42], p=1.0000) |
| derived | close_known | sp30 | present2 | `present_soft=1;present_soft_only` | 30/435 | 17/228 | 22/237 -> 13/237 (9.3% -> 5.5%, lift -3.80 pp, 95% [-7.54, +0.42], p=0.1755) | 5/152 -> 14/152 (3.3% -> 9.2%, lift +5.92 pp, 95% [+0.67, +10.81], p=0.0490) |
| derived | close_known | sp30 | absent2 | `present_soft=-0.25;kind_tilt=1` | 222/435 | 133/228 | 127/237 -> 129/237 (53.6% -> 54.4%, lift +0.84 pp, 95% [-4.07, +5.81], p=0.8679) | 83/152 -> 76/152 (54.6% -> 50.0%, lift -4.61 pp, 95% [-10.56, +0.78], p=0.2478) |

`sutta6`/`present2`/`absent2` are derived from the same `sp30` distribution the production model uses for them (Sutta list, present pair, absent pair). Panel tasks are evaluated on their own endpoint distribution.

## Jodi (built from the selected Sutta lists, as the app does)

| Output | Audit | October extension |
|---|---|---|
| jodi_pre5 | 58/237 -> 63/237 (24.5% -> 26.6%, lift +2.11 pp, 95% [-4.81, +8.43], p=0.5758) | 38/152 -> 45/152 (25.0% -> 29.6%, lift +4.61 pp, 95% [-2.96, +11.38], p=0.2649) |
| jodi_known5 | 61/237 -> 60/237 (25.7% -> 25.3%, lift -0.42 pp, 95% [-3.46, +2.47], p=1.0000) | 36/152 -> 40/152 (23.7% -> 26.3%, lift +2.63 pp, 95% [-3.33, +7.89], p=0.5413) |
| jodi_pre6 | 83/237 -> 87/237 (35.0% -> 36.7%, lift +1.69 pp, 95% [-5.09, +7.89], p=0.6718) | 49/152 -> 53/152 (32.2% -> 34.9%, lift +2.63 pp, 95% [-3.97, +8.82], p=0.5966) |
| jodi_known6 | 83/237 -> 81/237 (35.0% -> 34.2%, lift -0.84 pp, 95% [-4.76, +2.99], p=0.8450) | 63/152 -> 59/152 (41.4% -> 38.8%, lift -2.63 pp, 95% [-7.98, +3.07], p=0.5572) |

## What the production policy itself adds over the raw combined inputs

Diagnostic only (no selection). `raw` = no Sutta/appearance/avoid/present/conditional terms and the V1 DP-blend convention. This shows how much of the accuracy already comes from the frozen policy.

| Channel | Endpoint | Development | Validation | Audit | October extension |
|---|---|---|---|---|---|
| open | all10 | 34/435 -> 37/435 (7.8% -> 8.5%, lift +0.69 pp, 95% [-1.29, +2.68], p=0.7011) | 20/228 -> 23/228 (8.8% -> 10.1%, lift +1.32 pp, 95% [-2.95, +5.48], p=0.6476) | 15/237 -> 13/237 (6.3% -> 5.5%, lift -0.84 pp, 95% [-4.88, +3.20], p=0.7905) | 16/152 -> 18/152 (10.5% -> 11.8%, lift +1.32 pp, 95% [-2.61, +5.48], p=0.8145) |
| open | sp30 | 94/331 -> 119/331 (28.4% -> 36.0%, lift +7.55 pp, 95% [+1.81, +13.27], p=0.0134) | 42/169 -> 57/169 (24.9% -> 33.7%, lift +8.88 pp, 95% [+3.64, +14.44], p=0.0357) | 47/170 -> 43/170 (27.6% -> 25.3%, lift -2.35 pp, 95% [-11.38, +6.74], p=0.6655) | 41/115 -> 36/115 (35.7% -> 31.3%, lift -4.35 pp, 95% [-11.81, +3.74], p=0.4996) |
| open | dp20 | 33/103 -> 33/103 (32.0% -> 32.0%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 16/58 -> 16/58 (27.6% -> 27.6%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 20/65 -> 20/65 (30.8% -> 30.8%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) | 8/37 -> 8/37 (21.6% -> 21.6%, lift +0.00 pp, 95% [+0.00, +0.00], p=1.0000) |
| close_pre | all10 | 26/435 -> 31/435 (6.0% -> 7.1%, lift +1.15 pp, 95% [-0.44, +2.80], p=0.2668) | 14/228 -> 17/228 (6.1% -> 7.5%, lift +1.32 pp, 95% [-1.35, +4.29], p=0.5078) | 11/237 -> 14/237 (4.6% -> 5.9%, lift +1.27 pp, 95% [-1.19, +3.85], p=0.5488) | 7/152 -> 11/152 (4.6% -> 7.2%, lift +2.63 pp, 95% [-0.64, +6.25], p=0.2188) |
| close_pre | sp30 | 82/331 -> 87/331 (24.8% -> 26.3%, lift +1.51 pp, 95% [-0.92, +4.18], p=0.3323) | 35/164 -> 40/164 (21.3% -> 24.4%, lift +3.05 pp, 95% [-0.58, +6.33], p=0.2668) | 51/186 -> 47/186 (27.4% -> 25.3%, lift -2.15 pp, 95% [-5.26, +1.09], p=0.3877) | 29/111 -> 28/111 (26.1% -> 25.2%, lift -0.90 pp, 95% [-3.88, +2.02], p=1.0000) |
| close_pre | dp20 | 12/103 -> 21/103 (11.7% -> 20.4%, lift +8.74 pp, 95% [+0.00, +16.96], p=0.0931) | 15/63 -> 17/63 (23.8% -> 27.0%, lift +3.17 pp, 95% [-10.94, +17.03], p=0.8318) | 13/51 -> 12/51 (25.5% -> 23.5%, lift -1.96 pp, 95% [-16.67, +13.33], p=1.0000) | 13/41 -> 10/41 (31.7% -> 24.4%, lift -7.32 pp, 95% [-24.49, +9.76], p=0.6072) |
| close_known | all10 | 28/435 -> 39/435 (6.4% -> 9.0%, lift +2.53 pp, 95% [-0.49, +5.45], p=0.1173) | 18/228 -> 21/228 (7.9% -> 9.2%, lift +1.32 pp, 95% [-2.12, +4.47], p=0.6291) | 16/237 -> 18/237 (6.8% -> 7.6%, lift +0.84 pp, 95% [-3.03, +4.96], p=0.8318) | 14/152 -> 6/152 (9.2% -> 3.9%, lift -5.26 pp, 95% [-8.55, -1.91], p=0.0768) |
| close_known | sp30 | 81/331 -> 99/331 (24.5% -> 29.9%, lift +5.44 pp, 95% [-0.29, +10.86], p=0.0693) | 46/164 -> 52/164 (28.0% -> 31.7%, lift +3.66 pp, 95% [-4.00, +11.36], p=0.4709) | 45/186 -> 59/186 (24.2% -> 31.7%, lift +7.53 pp, 95% [+0.54, +14.77], p=0.0649) | 32/111 -> 30/111 (28.8% -> 27.0%, lift -1.80 pp, 95% [-13.19, +8.41], p=0.8642) |
| close_known | dp20 | 22/103 -> 24/103 (21.4% -> 23.3%, lift +1.94 pp, 95% [-6.86, +11.32], p=0.8601) | 19/63 -> 22/63 (30.2% -> 34.9%, lift +4.76 pp, 95% [-8.34, +18.75], p=0.7011) | 16/51 -> 15/51 (31.4% -> 29.4%, lift -1.96 pp, 95% [-23.26, +17.02], p=1.0000) | 13/41 -> 9/41 (31.7% -> 22.0%, lift -9.76 pp, 95% [-25.64, +4.17], p=0.4545) |

## Probabilistic quality on the October extension

Mean multiclass Brier and log loss over all 220 panels (lower is better).

| Channel / endpoint | Baseline Brier | Selected Brier | Baseline log loss | Selected log loss |
|---|---|---|---|---|
| open/all10 | 0.9947 | 0.9947 | 5.3015 | 5.3015 |
| open/sp30 | 0.9946 | 0.9946 | 5.2930 | 5.2930 |
| open/dp20 | 0.9946 | 0.9946 | 5.2871 | 5.2871 |
| close_pre/all10 | 1.0029 | 1.0034 | 6.1127 | 6.1827 |
| close_pre/sp30 | 1.0023 | 1.0023 | 6.0636 | 6.0636 |
| close_pre/dp20 | 1.0004 | 1.0039 | 5.8880 | 6.0553 |
| close_known/all10 | 0.9947 | 0.9947 | 5.2879 | 5.2879 |
| close_known/sp30 | 0.9946 | 0.9946 | 5.2799 | 5.2799 |
| close_known/dp20 | 0.9946 | 0.9946 | 5.2848 | 5.2848 |

## Fresh window (fetched once, after the selection was frozen)

Source rows: 14 events on 2026-10-16, 2026-10-17 from 11 markets (markets without fresh outcomes: Madhur Night), fetched 2026-10-17T11:06:13.131698+00:00. The fresh window postdates the hashed selection and was never used to choose any parameter; these columns are descriptive only.

| Kind | Channel | Endpoint | Task | Selected change | Baseline | Selected | Delta | Discordant win/loss | Exact p |
|---|---|---|---|---|---|---|---|---|---|
| panel | open | all10 | all10 | `production` | 0/14 | 0/14 | +0 | 0/0 | 1.000 |
| panel | open | sp30 | sp30 | `production` | 0/10 | 0/10 | +0 | 0/0 | 1.000 |
| panel | open | dp20 | dp20 | `production` | 1/4 | 1/4 | +0 | 0/0 | 1.000 |
| derived | open | sp30 | sutta6 | `present_soft=2;kind_tilt=-1` | 9/14 | 12/14 | +3 | 4/1 | 0.375 |
| derived | open | sp30 | present2 | `present_soft=2` | 0/14 | 0/14 | +0 | 0/0 | 1.000 |
| derived | open | sp30 | absent2 | `kind_tilt=0.25` | 6/14 | 6/14 | +0 | 0/0 | 1.000 |
| panel | close_pre | all10 | all10 | `kind_tilt=-0.5` | 0/14 | 0/14 | +0 | 0/0 | 1.000 |
| panel | close_pre | sp30 | sp30 | `production` | 3/12 | 3/12 | +0 | 0/0 | 1.000 |
| panel | close_pre | dp20 | dp20 | `present_soft=-1` | 0/2 | 0/2 | +0 | 0/0 | 1.000 |
| derived | close_pre | sp30 | sutta6 | `present_soft=-2;kind_tilt=-1` | 8/14 | 5/14 | -3 | 0/3 | 0.250 |
| derived | close_pre | sp30 | present2 | `present_soft=-2;kind_tilt=-0.25` | 0/14 | 0/14 | +0 | 0/0 | 1.000 |
| derived | close_pre | sp30 | absent2 | `present_soft=-1;kind_tilt=0.25` | 7/14 | 6/14 | -1 | 1/2 | 1.000 |
| panel | close_known | all10 | all10 | `production` | 1/14 | 1/14 | +0 | 0/0 | 1.000 |
| panel | close_known | sp30 | sp30 | `production` | 5/12 | 5/12 | +0 | 0/0 | 1.000 |
| panel | close_known | dp20 | dp20 | `production` | 1/2 | 1/2 | +0 | 0/0 | 1.000 |
| derived | close_known | sp30 | sutta6 | `present_soft=-0.5` | 10/14 | 10/14 | +0 | 0/0 | 1.000 |
| derived | close_known | sp30 | present2 | `present_soft=1;present_soft_only` | 2/14 | 0/14 | -2 | 0/2 | 0.500 |
| derived | close_known | sp30 | absent2 | `present_soft=-0.25;kind_tilt=1` | 8/14 | 9/14 | +1 | 2/1 | 1.000 |

| Jodi output | Baseline | Selected | Delta | Discordant win/loss | Exact p |
|---|---|---|---|---|---|
| jodi_pre5 | 3/14 | 4/14 | +1 | 2/1 | 1.000 |
| jodi_known5 | 4/14 | 7/14 | +3 | 4/1 | 0.375 |
| jodi_pre6 | 4/14 | 4/14 | +0 | 2/2 | 1.000 |
| jodi_known6 | 6/14 | 9/14 | +3 | 3/0 | 0.250 |

With 14 events this window can only detect very large effects; the exact paired test above is the strongest statement the sample supports.

## Interpretation

**Panel tasks keep production everywhere.** Every panel-level selection (all10, sp30, dp20 on all three channels) fell back to `production`: no candidate using `present_soft` or `kind_tilt` beat the production development rate subject to the validation tie-break. The new degrees of freedom only ever survived on derived tasks (Sutta-6 and the present/absent pairs), which are read off the same `sp30` endpoint the production Sutta list uses.

**The sealed blocks looked promising for the close-side Sutta-6.** `close_pre` Sutta-6 with `present_soft=-2;kind_tilt=-1` improved development 248/435 -> 259/435, validation 146/228 -> 155/228, audit 136/237 -> 144/237 and the October extension 81/152 -> 89/152, with consistent monthly totals (July -1, August +22, September +7, October +8). It is the only candidate positive in all four sealed blocks, and the `jodi_pre6` output built from it gained +25/+12/+4/+4 hits across those blocks.

**But the gain does not look like a new signal.** The term decomposition (`decompose.py`, `stability.json`) shows `present_soft=-2` alone carries most of the effect (+31 hits across the sealed blocks; `kind_tilt=-1` alone adds +14), and simply rescaling the policy's existing `appearance` term (`appearance=-2.5`) reproduces almost the same result (audit +5 vs +8, extension +7 vs +8). The soft present-digit probabilities and the appearance probabilities are near-duplicate statements about digit presence, so the study is largely re-weighting an input the policy already consumes rather than adding information.

**The fresh window contradicts the headline.** On the genuinely fresh 2026-10-16/17 window — fetched once, after `selection.json` was hashed, and never used to choose any parameter — `close_pre` Sutta-6 falls from 8/14 to 5/14 (three discordant events, all losses) and `jodi_pre6` is flat. The only fresh gain is `open` Sutta-6 (9/14 -> 12/14, exact p=0.375), which was not significant in the sealed blocks either. With 14 events nothing in the fresh table can reach significance, but the direction of the only untuned evidence is negative for the strongest sealed-block candidate.

**Verdict.** The two degrees of freedom remain unused in production, and this study does not justify using them: the sealed-block gains are best read as in-sample pattern, and the fresh window gives no confirmation. `combined-weighted-v1` stays as the production policy.

## Reproduce

```powershell
node research/combined_prediction_v3/dump_policy.cjs
node research/combined_prediction_v3/parity_check.cjs
python research/combined_prediction_v3/run_study.py select
python research/combined_prediction_v3/run_study.py evaluate
python research/combined_prediction_v3/fetch_fresh.py       # network; runs once, after selection
node research/combined_prediction_v3/feature_parity.cjs
node research/combined_prediction_v3/export_fresh.cjs
node research/combined_prediction_v3/parity_check_fresh.cjs
python research/combined_prediction_v3/score_fresh.py
python research/combined_prediction_v3/verify_study.py
```

The replays are frozen inputs produced by combined_prediction_v1/v2 from strictly prior dates. The fresh rows are fetched by `fetch_fresh.py` only after `selection.json` is hashed, and its source-identity gate must reproduce the sealed history exactly. `verify_study.py` re-derives every selected change from the frozen replay and compares the reconstructed production lists with real `buildCombinedAnalysis` calls in `parity_production.json` and `parity_production_fresh.json`.

Frozen selection SHA-256: `999b925e0994e21b96cdc78fb7004e92058b5d9e59725fe86c68d08a33b2eff6`.
