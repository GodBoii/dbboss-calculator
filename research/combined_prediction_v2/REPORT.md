# Wide prediction-combination research

## Result

No universal combination or market router is confirmed. Several historical winners fail the newly scored October extension. A few candidates retain small gains, but none of the 231 selected comparisons passes the exact day-cluster test with Holm correction. Production code and the previous frozen policy are unchanged.

Tested 9,081 panel candidates, 5,311 separate Sutta/present-pair/absent-pair/kind/Jodi variants, and 432 online controller settings. These are parameterized hypotheses, not thousands of independent scientific theories.

The previous V1 routed Close Top-30 policy improved September's final block from 45/237 to 59/237. On October 1-15 it regresses from 32/152 to 30/152. That reversal is the strongest reason not to promote the September result.

## Data and separation

- Exploration: 900 market-date events, July 4 through September 30. All three earlier blocks were already inspected and are explicitly exploratory.
- New extension for this policy selection: 152 complete market-date events from October 1 through October 15. This gives 304 actual Open/Close panels, not 27,360 independent outcomes.
- All twelve markets passed exact identity checks against 180 overlapping frozen observations each. Older frozen rows were retained; October was appended. Missing rows are not invented or assumed to be closed markets.
- Candidate definitions, coefficient fits, market mappings, confidence thresholds and online update rules were frozen, hashed and pushed before the full October collection. An earlier availability probe printed only Kalyan's latest date and count.
- This is not a pre-event forecast registry. The extension outcomes already existed publicly, some October 1-2 dates occur in older repository audits, and current base-model selection has used historical outcomes. No October outcomes were read by the selection scripts. October 3-15 is also reported as a post-hoc sensitivity check without changing any policy.
- Other same-day markets enter a model only when their configured result time plus ten minutes precedes the forecast time. Before-Open Close uses the target Open time as its information cutoff. Historical publication timestamps are unavailable, so scheduled availability remains an assumption.
- Online rules update after the whole market-date. They never use today's target Close to select an Open prediction.

Frozen policy SHA-256: `2da9ea05e93f0a507355f7c047351696871f259d3f7f8aaf9a00a9c1093dcc16`.

## What was actually tried

1. Positive and negative Sutta and appearance weights, multipliers from 0.01 to 10, and direct/conditional Close corrections.
2. Arithmetic, geometric and harmonic averaging; minimum, maximum and median consensus; reciprocal-rank fusion, Borda ranks and majority voting.
3. Digit rotations by 1/3/5/7/9, mirror maps, opposite digits, cold/hot frequencies, gaps and previous-panel overlap.
4. Sutta bucket allocation, preserved Top-1/3/6/10 prefixes, greedy digit/Sutta diversification, near-hard constraints and XOR/conflict rules.
5. Nonlinear feature interactions and sign flips based on weekday/weekend, previous DP, declared Open kind, model agreement and earlier-source count.
6. Strictly earlier scheduled-market digit/Sutta context, plus regularized pooled and DP-only stacking. Stacks use three expanding historical refit folds; final coefficients use dates through September 30 only.
7. Shared and stability-penalized choices, local routes shrunk with 30/100/300 prior observations, selection excluding the target market, and causal local/global online experts.
8. Joint digit-pair models, separate Sutta combinations, 25/36-pair Jodi rankers, selective confidence/agreement gates, frequency controls and seeded random controls.

All exact-panel outputs contain the requested number of unique legal panels. SP means three different digits; DP means exactly two different digits; TP is separate. DP/SP conditional rates and unconditional rates are kept separate.

## October panel results

The table reports the preselected stable policy, local prior-100 policy and guarded online policy. Mean-winning, prior-30/prior-300, leave-market-out and both V1 policies are included in extension_results.json and the exact call ledger. A 0 net change may mean the guard retained the baseline.

| Channel | Task | Baseline | Stable rule | Local prior 100 | Online guarded |
|---|---|---:|---:|---:|---:|
| open | all10 | 16/152 (10.5%) | 16/152 (10.5%) | 11/152 (7.2%) | 14/152 (9.2%) |
| open | all30 | 41/152 (27.0%) | 39/152 (25.7%) | 36/152 (23.7%) | 41/152 (27.0%) |
| open | sp30 | 41/115 (35.7%) | 39/115 (33.9%) | 38/115 (33.0%) | 41/115 (35.7%) |
| open | dp10 | 6/37 (16.2%) | 8/37 (21.6%) | 7/37 (18.9%) | 6/37 (16.2%) |
| open | dp20 | 8/37 (21.6%) | 8/37 (21.6%) | 9/37 (24.3%) | 8/37 (21.6%) |
| open | dp30 | 15/37 (40.5%) | 10/37 (27.0%) | 12/37 (32.4%) | 15/37 (40.5%) |
| close_pre | all10 | 7/152 (4.6%) | 13/152 (8.6%) | 8/152 (5.3%) | 7/152 (4.6%) |
| close_pre | all30 | 28/152 (18.4%) | 27/152 (17.8%) | 22/152 (14.5%) | 24/152 (15.8%) |
| close_pre | sp30 | 29/111 (26.1%) | 32/111 (28.8%) | 21/111 (18.9%) | 29/111 (26.1%) |
| close_pre | dp10 | 7/41 (17.1%) | 5/41 (12.2%) | 3/41 (7.3%) | 7/41 (17.1%) |
| close_pre | dp20 | 13/41 (31.7%) | 9/41 (22.0%) | 10/41 (24.4%) | 12/41 (29.3%) |
| close_pre | dp30 | 19/41 (46.3%) | 18/41 (43.9%) | 18/41 (43.9%) | 20/41 (48.8%) |
| close_known | all10 | 14/152 (9.2%) | 10/152 (6.6%) | 14/152 (9.2%) | 11/152 (7.2%) |
| close_known | all30 | 32/152 (21.1%) | 28/152 (18.4%) | 28/152 (18.4%) | 34/152 (22.4%) |
| close_known | sp30 | 32/111 (28.8%) | 27/111 (24.3%) | 31/111 (27.9%) | 29/111 (26.1%) |
| close_known | dp10 | 7/41 (17.1%) | 8/41 (19.5%) | 7/41 (17.1%) | 4/41 (9.8%) |
| close_known | dp20 | 13/41 (31.7%) | 15/41 (36.6%) | 15/41 (36.6%) | 13/41 (31.7%) |
| close_known | dp30 | 15/41 (36.6%) | 18/41 (43.9%) | 21/41 (51.2%) | 15/41 (36.6%) |

Open is forecast before Open; close_pre is forecast before Open; close_known uses the same market's declared Open. DP lists are evaluated conditional on actual DP, and SP30 conditional on actual SP. Each channel has only 152 extension events; actual DP subsets have 37 Open and 41 Close events.

## Promising points and failures

- Pre-Open Close Top-10 stable: 7/152 to 13/152, 4.6% to 8.6%. Its 95% date-bootstrap lift interval spans a loss; the day-cluster p-value is about .324. The rule deliberately reverses Sutta, appearance and conditional-Close adjustments while boosting predicted-absent digits. This is a measured research variant, not proof the models are universally inverted.
- Known-Open Close DP Top-20 stable: 13/41 to 15/41. The selected map mirrors digit appearance around 3 with weight 0.25. Two additional hits are too few to establish an advantage.
- Jodi-25 stable: 34/152 to 40/152. It uses 75% reciprocal-rank support from the last 30 historical Jodis and 25% from the native pair ranking. Jodi-36 uses a 50/50 arithmetic mixture and rises from 53/152 to 56/152. Both remain unconfirmed.
- Open Top-30 stable: 41/152 to 39/152. More aggressive historical fitting did not improve the extension.
- Close-known Sutta Top-3 stable: 51/152 to 32/152. Close-pre absent-pair market routing falls from 84/152 to 67/152. These failures are included alongside gains.
- Seeded random controls reached 34/152 for a pre-Open Close Top-30 family leader against 28/152 baseline, and 34/152 for known-Open Close against 32/152. A small isolated lift is therefore an inadequate selection standard.

## Exact stable recipes

These choices were frozen before the October extension was admitted for evaluation. Full learned coefficients are in the catalogues.

| Channel | Task | Candidate | Definition |
|---|---|---:|---|
| open | all10 | 2603 | `regime_flip: {"state":"dp_recent","threshold":0.3,"feature":"sutta","weight":0.25}` |
| open | all30 | 253 | `loglinear: {"sutta":4.0,"appearance":-0.25,"avoid_multiplier":1.0,"present_multiplier":1.25,"dp_blend":0.0,"conditional_close":0.0}` |
| open | sp30 | 253 | `loglinear: {"sutta":4.0,"appearance":-0.25,"avoid_multiplier":1.0,"present_multiplier":1.25,"dp_blend":0.0,"conditional_close":0.0}` |
| open | dp10 | 2752 | `ridge_stack, L2=0.1, DP-only=True; full coefficients in catalogue` |
| open | dp20 | 1176 | `loglinear: {"sutta":0.0,"appearance":0.0,"avoid_multiplier":1.0,"present_multiplier":1.0,"dp_blend":1.0,"conditional_close":0.0}` |
| open | dp30 | 54 | `consensus: {"experts":["base","sutta","dp"],"method":"minimum"}` |
| close_pre | all10 | 580 | `loglinear: {"sutta":-0.5,"appearance":-1.0,"avoid_multiplier":10.0,"present_multiplier":1.0,"dp_blend":0.5,"conditional_close":-2.0}` |
| close_pre | all30 | 310 | `loglinear: {"sutta":0.125,"appearance":-0.25,"avoid_multiplier":4.0,"present_multiplier":1.0,"dp_blend":0.0,"conditional_close":2.0}` |
| close_pre | sp30 | 751 | `loglinear: {"sutta":0.125,"appearance":-2.0,"avoid_multiplier":10.0,"present_multiplier":2.0,"dp_blend":0.0,"conditional_close":1.0}` |
| close_pre | dp10 | 2633 | `random_control: {"seed":4}` |
| close_pre | dp20 | 242 | `loglinear: {"sutta":0.0,"appearance":-0.25,"avoid_multiplier":1.0,"present_multiplier":10.0,"dp_blend":0.0,"conditional_close":0.0}` |
| close_pre | dp30 | 512 | `loglinear: {"sutta":1.0,"appearance":-1.0,"avoid_multiplier":1.0,"present_multiplier":1.0,"dp_blend":0.75,"conditional_close":-2.0}` |
| close_known | all10 | 2990 | `regime_flip: {"state":"source_count","threshold":4,"feature":"live_sutta","weight":1}` |
| close_known | all30 | 2989 | `regime_flip: {"state":"source_count","threshold":4,"feature":"live_sutta","weight":0.25}` |
| close_known | sp30 | 2990 | `regime_flip: {"state":"source_count","threshold":4,"feature":"live_sutta","weight":1}` |
| close_known | dp10 | 2926 | `regime_flip: {"state":"known_open_dp","threshold":0.5,"feature":"appearance","weight":0.25}` |
| close_known | dp20 | 3071 | `transformed_digits: {"transform":"mirror","amount":3,"weight":0.25,"target":"appearance"}` |
| close_known | dp30 | 1034 | `loglinear: {"sutta":0.0,"appearance":0.0,"avoid_multiplier":1.0,"present_multiplier":1.0,"dp_blend":0.25,"conditional_close":-0.5}` |

## Market reversals

The same pre-Open Close Top-10 stable formula gains two hits in Kalyan and Kalyan Night, but loses two in Sridevi and one each in Sridevi Night and Time Bazar. A positive pooled result does not establish a positive local result.

The previous routed Close Top-30 policy keeps a Kalyan Night gain in October, 2/11 to 5/11, while losing in Time Bazar, 5/13 to 3/13, and Sridevi Night, 2/15 to 0/15. Different routes are already part of that policy; market-specific tuning still does not guarantee local stability.

| Market | Extension events | Pre-Open Close Top-10 baseline / stable | Previous Close-known Top-30 baseline / routed |
|---|---:|---|---|
| Kalyan | 13 | 0 / 2 | 2 / 3 |
| Kalyan Night | 11 | 0 / 2 | 2 / 5 |
| Madhur Day | 15 | 0 / 1 | 4 / 3 |
| Madhur Night | 9 | 0 / 0 | 2 / 1 |
| Main Bazar | 11 | 1 / 2 | 2 / 1 |
| Milan Day | 13 | 0 / 0 | 0 / 0 |
| Milan Night | 13 | 0 / 2 | 3 / 3 |
| Rajdhani Day | 13 | 2 / 2 | 4 / 4 |
| Rajdhani Night | 11 | 0 / 2 | 2 / 3 |
| Sridevi | 15 | 2 / 0 | 4 / 4 |
| Sridevi Night | 15 | 1 / 0 | 2 / 0 |
| Time Bazar | 13 | 1 / 0 | 5 / 3 |

Kalyan Night's earlier V1 route has net gains of +1, +4 and +3 across the three exploratory blocks, then +3 in October. This is the most consistent local observation for that route, but it was found among many market/task choices and October contains only eleven events. It remains a candidate for a future frozen test.

![Market reversals](/C:/Users/prajw/Downloads/dbboss-calculator/research/combined_prediction_v2/market_reversals.png)

## Model-family transfer

Every family leader below was chosen on July-September, then scored unchanged. Values are net October hits versus the relevant baseline. These 84 family/endpoint diagnostics are exploratory; they do not select another October winner.

| Family | Open Top-30 | Close-pre Top-30 | Close-known Top-30 | Open DP20 | Close-pre DP20 | Close-known DP20 |
|---|---:|---:|---:|---:|---:|---:|
| consensus | -3 | +2 | -8 | +4 | -4 | -2 |
| constraint_tilt | -1 | -8 | -1 | -1 | +2 | -4 |
| greedy_diversification | +0 | -5 | -2 | +3 | -3 | -2 |
| historical_tilt | +0 | -3 | -6 | +1 | +2 | +0 |
| loglinear | -2 | -1 | -3 | +0 | -4 | +0 |
| mixture | -6 | -2 | -7 | +0 | -4 | -1 |
| nonlinear_interaction | -16 | +1 | -11 | +3 | -1 | -3 |
| preserve_prefix | -3 | -2 | -2 | -1 | -6 | +2 |
| random_control | -17 | +6 | +2 | +1 | -5 | -5 |
| rank_fusion | +1 | +3 | -9 | +0 | -2 | -2 |
| regime_flip | -1 | +0 | -4 | +2 | +2 | -1 |
| ridge_stack | +0 | +1 | -6 | +4 | -3 | +3 |
| sutta_buckets | -10 | -5 | -9 | -1 | +2 | +1 |
| transformed_digits | -6 | -1 | +0 | +1 | -6 | +2 |

The full file family_extension.csv covers every panel task and family. market_matrix.csv gives every market's extension result for every selected policy and family. historical_market_matrix.csv adds 13,608 earlier market/block comparisons, explicitly marked as exploratory.

## Secondary outputs

The stable and market-routed versions are independently selected per output. Marginal-independence pair scores are tested as an approximation; true joint co-presence/absence scores are also tested. No individual-digit success is counted as a successful two-digit pair.

| Channel | Output | Native | Stable | Market routes |
|---|---|---:|---:|---:|
| open | sutta3 | 58/152 (38.2%) | 45/152 (29.6%) | 42/152 (27.6%) |
| open | sutta6 | 95/152 (62.5%) | 95/152 (62.5%) | 100/152 (65.8%) |
| open | present2 | 15/152 (9.9%) | 9/152 (5.9%) | 13/152 (8.6%) |
| open | absent2 | 78/152 (51.3%) | 78/152 (51.3%) | 82/152 (53.9%) |
| open | kind | 115/152 (75.7%) | 115/152 (75.7%) | 115/152 (75.7%) |
| open | jodi25 | 34/152 (22.4%) | 40/152 (26.3%) | 40/152 (26.3%) |
| open | jodi36 | 53/152 (34.9%) | 56/152 (36.8%) | 48/152 (31.6%) |
| close_pre | sutta3 | 51/152 (33.6%) | 51/152 (33.6%) | 50/152 (32.9%) |
| close_pre | sutta6 | 86/152 (56.6%) | 87/152 (57.2%) | 94/152 (61.8%) |
| close_pre | present2 | 12/152 (7.9%) | 13/152 (8.6%) | 6/152 (3.9%) |
| close_pre | absent2 | 84/152 (55.3%) | 76/152 (50.0%) | 67/152 (44.1%) |
| close_pre | kind | 111/152 (73.0%) | 111/152 (73.0%) | 111/152 (73.0%) |
| close_known | sutta3 | 51/152 (33.6%) | 32/152 (21.1%) | 49/152 (32.2%) |
| close_known | sutta6 | 86/152 (56.6%) | 86/152 (56.6%) | 97/152 (63.8%) |
| close_known | present2 | 12/152 (7.9%) | 6/152 (3.9%) | 9/152 (5.9%) |
| close_known | absent2 | 84/152 (55.3%) | 75/152 (49.3%) | 79/152 (52.0%) |
| close_known | kind | 111/152 (73.0%) | 111/152 (73.0%) | 111/152 (73.0%) |

## Confidence, abstention and hard constraints

All 162 frozen top-K mass, boundary-margin and model-agreement gates are included in confidence_gates.csv. Called predictions are compared with the baseline on exactly the same observations. A no-call is not a hit. These ranking/confidence scores have not been calibrated into reliable betting probabilities.

For example, the upper-quartile Open Top-30 mass gate calls 30/152 observations and scores 8/30 versus the baseline's 10/30 on those same calls. The corresponding Close-known gate calls 25/152 and scores 5/25 versus 6/25. More selective confidence is not automatically better.

The hard intersection of native Sutta Top-6 and the absent pair allows the actual panel through on 49/152 Open outcomes and 51/152 Close outcomes. Those are eligibility ceilings for that intersection on this sample, not achieved Top-30 accuracy. All constraint counts and undersized-list checks are in hard_constraint_diagnostics.csv.

## Sensitivity and uncertainty

October 3-15 leaves 128 events per channel after excluding dates that occur in earlier October audits. No parameters or market routes are changed. The following sensitivity table is post-hoc and descriptive.

| Channel / task / policy | October 1-15 baseline / candidate | October 3-15 baseline / candidate |
|---|---|---|
| close_pre / all10 / global_stable | 7/152 / 13/152 | 7/128 / 12/128 |
| close_known / dp20 / global_stable | 13/41 / 15/41 | 10/34 / 14/34 |
| close_known / all30 / online_guarded | 32/152 / 34/152 | 26/128 / 26/128 |
| close_known / all30 / v1_routed | 32/152 / 30/152 | 26/128 / 23/128 |
| open / all30 / global_stable | 41/152 / 39/152 | 35/128 / 34/128 |

Uncertainty uses 10,000 whole-date bootstrap replicates, exact sign flips of whole-date paired differences, and Holm correction across all 231 selected panel/secondary comparisons. McNemar p-values are saved as a separate event-paired diagnostic. No selected comparison clears the adjusted day-cluster threshold. Per-market samples and DP subsets are especially small.

## Decision

Keep every candidate research-only. Preserve the October failures rather than retuning and calling the same dates a holdout again. Kalyan Night's previous local route, the pre-Open Close Top-10 reversal rule and the 30-draw Jodi blend are specific candidates worth freezing for another independently collected extension. No evidence here supports one common multiplier, automatic absent-digit exclusion, or a confirmed increase across all markets.

## Verification and reproduction

Verified source identities and hashes, all candidate families, exact list sizes/types, causal earlier-source context, exclusion of later same-day markets and undeclared own Open, future-reward poisoning for online rules, DP-only preservation, and all 27,360 panel plus 7,752 secondary October prediction lists. Every published count is reconciled to an exact call ledger. Adding audit details did not alter any of the original 231 comparison statistics.

```powershell
# Regenerate ignored historical caches only with unchanged frozen code:
node research/combined_prediction_v1/export_replay.cjs
python research/combined_prediction_v2/wide_search.py open
python research/combined_prediction_v2/wide_search.py close_pre
python research/combined_prediction_v2/wide_search.py close_known
python research/combined_prediction_v2/secondary_search.py
# Regenerated definitions must match freeze_manifest.json exactly.
# Do not refreeze this study; freeze.py rejects an existing October snapshot.
# Score the committed October snapshot without fetching the source again:
node research/combined_prediction_v2/export_extension.cjs
python research/combined_prediction_v2/evaluate_extension.py
python research/combined_prediction_v2/historical_breakdown.py
python research/combined_prediction_v2/verify_study.py
python research/combined_prediction_v2/report_study.py
```

Python dependencies are NumPy, SciPy, requests, BeautifulSoup, scikit-learn and Matplotlib. The source parser imports scikit-learn; the search itself uses SciPy for bounded conditional-logit optimization. Node uses the repository's installed TypeScript package.

Raw replay/OOF/hit caches are regenerable and ignored by Git. Candidate catalogues, frozen coefficients and routes, source snapshot, identities, results, every selected exact call, all search summaries and the report are committed. Rebuilding after historical source or production source changes produces a different study and must not overwrite this frozen experiment.
