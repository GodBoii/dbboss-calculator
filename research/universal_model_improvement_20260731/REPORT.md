# Universal prediction model improvement research

Generated from production baseline `1.0.20` / sutta model `1.0.9-above90`.

## Executive decision

This is research-only. Production source was not edited. Candidate selection used Q4 2025 discovery and Q1 2026 confirmation. April-June, July 1-23, and July 24-30 were not used to select routes.

## Baseline and routed sutta/Jodi performance

| Block | Open production | Open route | Close production | Close route | Jodi production | Jodi route |
| --- | --- | --- | --- | --- | --- | --- |
| discovery | 65.1% (574/882) | 69.6% (614/882) | 60.3% (532/882) | 71.3% (629/882) | 39.2% (346/882) | 50.2% (443/882) |
| confirmation | 65.1% (585/899) | 66.9% (601/899) | 63.1% (567/899) | 65.3% (587/899) | 42.0% (378/899) | 44.5% (400/899) |
| holdout | 67.9% (633/932) | 67.3% (627/932) | 68.5% (638/932) | 62.0% (578/932) | 47.0% (438/932) | 42.1% (392/932) |
| recent | 64.6% (155/240) | 64.6% (155/240) | 62.9% (151/240) | 60.4% (145/240) | 41.7% (100/240) | 37.9% (91/240) |
| prospective | 57.4% (39/68) | 66.2% (45/68) | 60.3% (41/68) | 60.3% (41/68) | 30.9% (21/68) | 38.2% (26/68) |

## Market-wise frozen sutta routes

Each holdout cell is `candidate vs production`.

| Market | Open expert | Open holdout | Close expert | Close holdout | Jodi holdout |
| --- | --- | --- | --- | --- | --- |
| Sridevi | production | 69.2% (63/91) vs 69.2% (63/91) | hot_w15 | 63.7% (58/91) vs 70.3% (64/91) | 44.0% (40/91) vs 48.4% (44/91) |
| Time Bazar | production | 66.7% (52/78) vs 66.7% (52/78) | previous_market::Sridevi::open | 60.3% (47/78) vs 57.7% (45/78) | 42.3% (33/78) vs 35.9% (28/78) |
| Madhur Day | production | 74.7% (68/91) vs 74.7% (68/91) | markov_self_l1 | 65.9% (60/91) vs 74.7% (68/91) | 48.4% (44/91) vs 58.2% (53/91) |
| Milan Day | previous_market::Milan Night::open | 61.5% (48/78) vs 69.2% (54/78) | previous_market::Rajdhani Night::close | 59.0% (46/78) vs 69.2% (54/78) | 32.1% (25/78) vs 47.4% (37/78) |
| Rajdhani Day | ewm_h30 | 65.4% (51/78) vs 67.9% (53/78) | cold_w7 | 66.7% (52/78) vs 76.9% (60/78) | 43.6% (34/78) vs 51.3% (40/78) |
| Kalyan | ewm_h7 | 67.9% (53/78) vs 67.9% (53/78) | cold_w7 | 55.1% (43/78) vs 73.1% (57/78) | 34.6% (27/78) vs 52.6% (41/78) |
| Sridevi Night | production | 71.4% (65/91) vs 71.4% (65/91) | production | 73.6% (67/91) vs 73.6% (67/91) | 54.9% (50/91) vs 54.9% (50/91) |
| Kalyan Night | production | 79.0% (49/62) vs 79.0% (49/62) | previous_market::Milan Day::close | 53.2% (33/62) vs 64.5% (40/62) | 40.3% (25/62) vs 50.0% (31/62) |
| Madhur Night | transition_ensemble | 57.7% (45/78) vs 57.7% (45/78) | delta_l5 | 59.0% (46/78) vs 64.1% (50/78) | 33.3% (26/78) vs 39.7% (31/78) |
| Milan Night | markov_cross_l5 | 61.5% (48/78) vs 59.0% (46/78) | production | 57.7% (45/78) vs 57.7% (45/78) | 38.5% (30/78) vs 33.3% (26/78) |
| Rajdhani Night | production | 69.2% (45/65) vs 69.2% (45/65) | production | 72.3% (47/65) vs 72.3% (47/65) | 52.3% (34/65) vs 52.3% (34/65) |
| Main Bazar | cold_w365 | 62.5% (40/64) vs 62.5% (40/64) | previous_market::Milan Day::open | 53.1% (34/64) vs 64.1% (41/64) | 37.5% (24/64) vs 35.9% (23/64) |

## SP/DP research

Accuracy-first models are allowed to favor SP heavily; balanced models are judged on equal SP/DP recall. This prevents a high raw accuracy from hiding zero DP detection.

| Side | Objective | Model | Block | Candidate accuracy | Production accuracy | Candidate DP recall | Production DP recall | p |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| open | accuracyFirst | always_SP | holdout | 71.1% | 63.2% | 0.0% | 23.0% | 0.0000 |
| open | accuracyFirst | always_SP | recent | 77.9% | 63.7% | 0.0% | 20.8% | 0.0000 |
| open | accuracyFirst | always_SP | prospective | 76.5% | 60.3% | 0.0% | 18.8% | 0.0127 |
| open | balanced | dp_bias_t1.10 | holdout | 51.1% | 63.2% | 49.1% | 23.0% | 0.0000 |
| open | balanced | dp_bias_t1.10 | recent | 49.6% | 63.7% | 54.7% | 20.8% | 0.0001 |
| open | balanced | dp_bias_t1.10 | prospective | 47.1% | 60.3% | 62.5% | 18.8% | 0.0931 |
| close | accuracyFirst | dp_bias_t1.90 | holdout | 75.8% | 70.4% | 1.3% | 16.1% | 0.0000 |
| close | accuracyFirst | dp_bias_t1.90 | recent | 72.5% | 65.0% | 0.0% | 15.4% | 0.0051 |
| close | accuracyFirst | dp_bias_t1.90 | prospective | 79.4% | 75.0% | 0.0% | 21.4% | 0.5078 |
| close | balanced | production | holdout | 70.4% | 70.4% | 16.1% | 16.1% | 1.0000 |
| close | balanced | production | recent | 65.0% | 65.0% | 15.4% | 15.4% | 1.0000 |
| close | balanced | production | prospective | 75.0% | 75.0% | 21.4% | 21.4% | 1.0000 |

## Diagnostic controls (not prediction candidates)

| Hypothesis | Later net hits | Decision |
| --- | --- | --- |
| open SP/DP accuracyFirst: always_SP | 119 | DIAGNOSTIC ONLY: rejects every DP |
| close SP/DP accuracyFirst: dp_bias_t1.90 | 71 | DIAGNOSTIC ONLY: near-zero DP recall |

## Hypotheses rejected in this cycle

| Hypothesis | Later net hits | Decision |
| --- | --- | --- |
| open market-specific expert routing | 0 | REJECT |
| close market-specific expert routing | -66 | REJECT |
| open SP/DP balanced: dp_bias_t1.10 | -156 | REJECT |
| close SP/DP balanced: production | 0 | REJECT |

## Hypothesis library covered

- Previous-result windows: 2, 3, 5, 7, 10, 15, 30, 60, 90, 180, 365 and 730 draws.
- Frequency saturation: hot/cold ranks and exponentially weighted half-lives 3-120.
- Transitions: own-side and cross-side Markov lags 1, 2, 3, 5 and 7; modular deltas.
- Calendar: weekday, same weekday, date-of-month and opposite-weekday echoes.
- Mathematical theories: opposite digits, low/high, odd/even and prime/composite continuation/rotation.
- Position behavior: previous panel first, middle and final digit conditioning.
- Cross-market graph: every prior-market Open/Close source into every target side.
- Day-to-night/live sequence: same-day earlier-market sources were measured separately and never mixed into pre-day production comparisons.
- Interactions: frequency, transition and calendar/panel-position ensembles.
- Regime response: short/medium/long windows and exponential decay serve as adaptive regime experts.

## Multiple-testing and overfitting control

Many experts were searched. A candidate had to beat production in discovery, remain non-negative in confirmation, and was then frozen. Later blocks determine credibility. Nominal McNemar p-values are shown but are not treated as family-wise significant without correction. A short-window 75-100% result with four draws is not promotion evidence.

## Existing family audits incorporated

- Exact panels: the frozen learned Top-60 model reached 34.7% Open and 39.9% Close on 974 terminal rows; hierarchical and cross-market challengers failed later confirmation.
- Absent digits: the strongest nested ridge candidate improved aggregates but failed paired confirmation and worst-route stability; no 80% Wilson-lower-bound call exists.
- Present digits: the selected 180-draw co-appearance model remained near 6% and is correctly research-only.

## Failure analysis

- Sutta Top-6 and Jodi-36 have nominal random coverages of 60% and 36%; small gains frequently reverse by market and month.
- Cross-market edges are numerous enough that the best in-sample edge is usually a multiple-testing artifact.
- SP is the majority kind. Always-SP or high DP thresholds can raise accuracy while destroying DP recall.
- Exact-panel history contains very little stable pre-draw information relative to the 220-class outcome space.
- Digit-pair confidence remains weakly discriminative; high displayed scores must not be interpreted as high success probability.

## Recommendation

The accuracy-first SP/DP rows are majority-class controls, not viable prediction candidates. No candidate should change production. The three stable market-local sutta signals identified in the consolidated report may enter a frozen shadow registry, but promotion requires an independent block of at least 100 calls per route, acceptable worst-period behavior, and corrected statistical evidence.
