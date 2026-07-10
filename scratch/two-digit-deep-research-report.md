# Deep Research - 2-Digit Elimination Model

Generated: 2026-07-09T10:11:28.855Z
Candidate models tested: 134
Backtest window: latest 30 records per market/side

## Overall

- Baseline strict accuracy: 51.2% (369/720)
- Improved/guarded strict accuracy: 57.1% (411/720)
- Baseline average correctly eliminated digits: 1.46 / 2
- Improved average correctly eliminated digits: 1.53 / 2
- Market-sides at or above 70% strict: 2/24
- Market-sides at or above 80% strict: 0/24
- Market-sides replaced after validation+test guard: 15/24

## Market-Specific Comparison

| Market | Side | Baseline | Best Candidate Val | Best Candidate Test | Final Used | Final | Avg Digits | Confidence | Delta |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| Sridevi | open | 53.3% (16/30) | 62.2% (56/90) | 63.3% (19/30) | pair_absence_l10 | 63.3% (19/30) | 1.57 | 62.6 | 10.0 pts |
| Sridevi | close | 46.7% (14/30) | 68.9% (62/90) | 60.0% (18/30) | short_long_fade_l60 | 60.0% (18/30) | 1.57 | 66.2 | 13.3 pts |
| Time Bazar | open | 53.3% (16/30) | 65.6% (59/90) | 50.0% (15/30) | current_app_top30_exposure | 53.3% (16/30) | 1.53 | 61.9 | 0.0 pts |
| Time Bazar | close | 60.0% (18/30) | 61.1% (55/90) | 66.7% (20/30) | prev_opp_sutta_pair_l180 | 66.7% (20/30) | 1.63 | 62.8 | 6.7 pts |
| Madhur Day | open | 56.7% (17/30) | 64.4% (58/90) | 70.0% (21/30) | hot_fade_digits_l60 | 70.0% (21/30) | 1.70 | 66.1 | 13.3 pts |
| Madhur Day | close | 50.0% (15/30) | 68.9% (62/90) | 60.0% (18/30) | cross_market_pair_l7 | 60.0% (18/30) | 1.57 | 66.2 | 10.0 pts |
| Milan Day | open | 50.0% (15/30) | 61.1% (55/90) | 60.0% (18/30) | prev_house_shape_pair_l90 | 60.0% (18/30) | 1.57 | 60.8 | 10.0 pts |
| Milan Day | close | 46.7% (14/30) | 67.8% (61/90) | 46.7% (14/30) | pair_absence_l7 | 46.7% (14/30) | 1.37 | 61.4 | 0.0 pts |
| Rajdhani Day | open | 36.7% (11/30) | 66.7% (60/90) | 53.3% (16/30) | prime | 53.3% (16/30) | 1.47 | 62.7 | 16.7 pts |
| Rajdhani Day | close | 56.7% (17/30) | 64.4% (58/90) | 46.7% (14/30) | current_app_top30_exposure | 56.7% (17/30) | 1.53 | 62.1 | 0.0 pts |
| Kalyan | open | 43.3% (13/30) | 63.3% (57/90) | 33.3% (10/30) | current_app_top30_exposure | 43.3% (13/30) | 1.40 | 57.3 | 0.0 pts |
| Kalyan | close | 50.0% (15/30) | 61.1% (55/90) | 53.3% (16/30) | same_dom_pair_l365 | 53.3% (16/30) | 1.53 | 58.8 | 3.3 pts |
| Sridevi Night | open | 50.0% (15/30) | 62.2% (56/90) | 50.0% (15/30) | root_condition_pair_l60 | 50.0% (15/30) | 1.47 | 58.6 | 0.0 pts |
| Sridevi Night | close | 60.0% (18/30) | 61.1% (55/90) | 50.0% (15/30) | current_app_top30_exposure | 60.0% (18/30) | 1.53 | 60.8 | 0.0 pts |
| Kalyan Night | open | 50.0% (15/30) | 64.4% (58/90) | 33.3% (10/30) | current_app_top30_exposure | 50.0% (15/30) | 1.40 | 60.1 | 0.0 pts |
| Kalyan Night | close | 53.3% (16/30) | 56.7% (51/90) | 63.3% (19/30) | digits_both_recently_present | 63.3% (19/30) | 1.60 | 58.7 | 10.0 pts |
| Madhur Night | open | 46.7% (14/30) | 63.3% (57/90) | 56.7% (17/30) | prev_opp_sutta_pair_l60 | 56.7% (17/30) | 1.53 | 61.3 | 10.0 pts |
| Madhur Night | close | 56.7% (17/30) | 63.3% (57/90) | 40.0% (12/30) | current_app_top30_exposure | 56.7% (17/30) | 1.53 | 61.3 | 0.0 pts |
| Milan Night | open | 60.0% (18/30) | 64.4% (58/90) | 56.7% (17/30) | current_app_top30_exposure | 60.0% (18/30) | 1.47 | 63.1 | 0.0 pts |
| Milan Night | close | 43.3% (13/30) | 62.2% (56/90) | 46.7% (14/30) | sum_bucket_pair_l365 | 46.7% (14/30) | 1.47 | 57.6 | 3.3 pts |
| Rajdhani Night | open | 50.0% (15/30) | 62.2% (56/90) | 43.3% (13/30) | current_app_top30_exposure | 50.0% (15/30) | 1.47 | 58.6 | 0.0 pts |
| Rajdhani Night | close | 46.7% (14/30) | 63.3% (57/90) | 73.3% (22/30) | cross_market_pair_l90 | 73.3% (22/30) | 1.70 | 66.3 | 26.7 pts |
| Main Bazar | open | 60.0% (18/30) | 66.7% (60/90) | 36.7% (11/30) | current_app_top30_exposure | 60.0% (18/30) | 1.57 | 64.7 | 0.0 pts |
| Main Bazar | close | 50.0% (15/30) | 64.4% (58/90) | 56.7% (17/30) | short_long_fade_l45 | 56.7% (17/30) | 1.53 | 62.1 | 6.7 pts |

## Hypothesis Families Selected

| Family | Selected | Strict Accuracy |
|---|---:|---:|
| pair-absence | 2 | 55.0% (33/60) |
| momentum-reversal | 2 | 58.3% (35/60) |
| baseline | 9 | 54.4% (147/270) |
| sutta-context | 2 | 61.7% (37/60) |
| frequency-hot-fade | 1 | 70.0% (21/30) |
| cross-market | 2 | 66.7% (40/60) |
| house-shape-context | 1 | 60.0% (18/30) |
| transition-house-streak | 1 | 53.3% (16/30) |
| calendar-date | 1 | 53.3% (16/30) |
| root-context | 1 | 50.0% (15/30) |
| gap-cycle | 1 | 63.3% (19/30) |
| sum-context | 1 | 46.7% (14/30) |

## Interpretation

- The baseline is the current app method converted to two digits: lowest weighted digit exposure inside the app's top 30 ranked panels.
- Candidate models are selected by the previous validation window, then checked on the latest 30 records.
- The guarded final column keeps the baseline unless the candidate also beats it on the latest-30 research backtest.
- A production replacement should use the validation rule only, then be monitored on fresh future results; using the last-30 result as a guard is for research reporting, not live fitting.

## Safety And AI-Agent Recommendation

- No tested market-side reached the 80% strict target on the latest-30 full-coverage evaluation.
- The strongest role for an LLM/AI agent is model auditing: reviewing evidence, rejecting overfit pockets, explaining why a call is unsafe, and forcing abstention when validation is weak.
- The LLM should not directly invent avoid digits from history. It should sit beside the statistical models as a validator and risk controller.
- For live use, display 2 avoid digits only when a market-specific model passes a pre-registered validation gate. Otherwise show a no-safe-call state.